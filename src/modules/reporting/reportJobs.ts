import { createHash, randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import type { DB } from '../../data/db';
import {
  withReportingWorkerTransaction,
  withTenantTransaction,
} from '../../data/tenantTransaction';
import { reportArtifact, reportJob } from '../../data/schema';
import {
  buildProfitLossReport,
  type ProfitLossComparison,
  type ProfitLossReport,
} from '../finance/profitLoss';

export type ReportFormat = 'xlsx' | 'pdf';

export interface ProfitLossExportFilters {
  periodId?: number;
  companyFns: string[];
  presentationCurrency: string;
  comparison: ProfitLossComparison;
}

export class ReportJobError extends Error {
  constructor(
    public readonly code:
      | 'report_job_invalid'
      | 'report_job_not_found'
      | 'report_artifact_not_found'
      | 'report_artifact_expired',
    message: string,
  ) {
    super(message);
    this.name = 'ReportJobError';
  }
}

function normalizedLocale(value: unknown): string {
  const locale = String(value || 'en').toLowerCase();
  return ['en', 'ms', 'zh', 'ja', 'vi'].includes(locale) ? locale : 'en';
}

function normalizedFormat(value: unknown): ReportFormat {
  if (value !== 'xlsx' && value !== 'pdf') {
    throw new ReportJobError('report_job_invalid', 'Format must be xlsx or pdf.');
  }
  return value;
}

export async function createProfitLossExportJobWithin(
  db: DB,
  scope: { masterFn: string; companyFn: string },
  input: {
    actorUserId: number;
    locale?: unknown;
    format: unknown;
    filters: ProfitLossExportFilters;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const format = normalizedFormat(input.format);
  if (!input.filters || !Array.isArray(input.filters.companyFns)
    || !input.filters.companyFns.length || input.filters.companyFns.length > 50) {
    throw new ReportJobError('report_job_invalid', 'Select 1–50 companies.');
  }
  const [created] = await db.insert(reportJob).values({
    ...scope,
    actorUserId: input.actorUserId,
    reportKey: 'profit_loss',
    format,
    locale: normalizedLocale(input.locale),
    presentationCurrency: String(input.filters.presentationCurrency).toUpperCase(),
    filters: input.filters,
    status: 'queued',
    availableAt: now,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  }).returning();
  return created;
}

export async function getReportJob(
  db: DB,
  input: { masterFn: string; actorUserId: number; id: number },
) {
  const [job] = await db.select({
    id: reportJob.id,
    companyFn: reportJob.companyFn,
    reportKey: reportJob.reportKey,
    format: reportJob.format,
    status: reportJob.status,
    attempts: reportJob.attempts,
    createdAt: reportJob.createdAt,
    completedAt: reportJob.completedAt,
    expiresAt: reportJob.expiresAt,
    lastError: reportJob.lastError,
    artifactId: reportArtifact.id,
    fileName: reportArtifact.fileName,
    mimeType: reportArtifact.mimeType,
    sizeBytes: reportArtifact.sizeBytes,
  }).from(reportJob).leftJoin(reportArtifact, and(
    eq(reportArtifact.masterFn, reportJob.masterFn),
    eq(reportArtifact.companyFn, reportJob.companyFn),
    eq(reportArtifact.jobId, reportJob.id),
  )).where(and(
    eq(reportJob.id, input.id),
    eq(reportJob.masterFn, input.masterFn),
    eq(reportJob.actorUserId, input.actorUserId),
  )).limit(1);
  if (!job) throw new ReportJobError('report_job_not_found', 'Report job not found.');
  return job;
}

export async function getReportArtifact(
  db: DB,
  input: { masterFn: string; actorUserId: number; artifactId: number; now?: Date },
) {
  const [artifact] = await db.select({
    id: reportArtifact.id,
    fileName: reportArtifact.fileName,
    mimeType: reportArtifact.mimeType,
    sha256: reportArtifact.sha256,
    sizeBytes: reportArtifact.sizeBytes,
    content: reportArtifact.content,
    expiresAt: reportArtifact.expiresAt,
  }).from(reportArtifact).innerJoin(reportJob, and(
    eq(reportJob.id, reportArtifact.jobId),
    eq(reportJob.masterFn, reportArtifact.masterFn),
    eq(reportJob.companyFn, reportArtifact.companyFn),
  )).where(and(
    eq(reportArtifact.id, input.artifactId),
    eq(reportArtifact.masterFn, input.masterFn),
    eq(reportJob.actorUserId, input.actorUserId),
    eq(reportJob.status, 'succeeded'),
  )).limit(1);
  if (!artifact) {
    throw new ReportJobError('report_artifact_not_found', 'Report artifact not found.');
  }
  if (artifact.expiresAt <= (input.now ?? new Date())) {
    throw new ReportJobError('report_artifact_expired', 'Report artifact has expired.');
  }
  return artifact;
}

const labels = {
  en: { title: 'Income Statement (P&L)', account: 'Account', period: 'This period', ytd: 'YTD', comparison: 'Comparison', variance: 'Variance', generated: 'Generated' },
  ms: { title: 'Penyata Untung & Rugi', account: 'Akaun', period: 'Tempoh ini', ytd: 'YTD', comparison: 'Perbandingan', variance: 'Varians', generated: 'Dijana' },
  zh: { title: '损益表', account: '科目', period: '本期', ytd: '年初至今', comparison: '比较', variance: '差异', generated: '生成时间' },
  ja: { title: '損益計算書', account: '勘定科目', period: '当期', ytd: '年度累計', comparison: '比較', variance: '差異', generated: '生成日時' },
  vi: { title: 'Báo cáo lãi lỗ', account: 'Tài khoản', period: 'Kỳ này', ytd: 'Lũy kế', comparison: 'So sánh', variance: 'Chênh lệch', generated: 'Đã tạo' },
} as const;

function reportFooter(report: ProfitLossReport): string {
  const companies = report.meta.companies.map((row) => `${row.name} (${row.currency})`).join(', ');
  const budgets = report.meta.companies
    .map((row) => row.budgetVersionId).filter((id) => id != null).join(', ') || '—';
  const rates = report.meta.companies.flatMap((row) => row.consolidationRates)
    .map((row) => `${row.fromCurrency}/${row.toCurrency} P${row.periodNo}=${row.averageRate}`)
    .join(', ') || 'same currency';
  return [
    report.data.period.label,
    companies,
    `Currency ${report.data.presentationCurrency}`,
    `Comparison ${report.data.comparison}`,
    `Budget version ${budgets}`,
    `FX ${rates}`,
    report.meta.generatedAt,
  ].join(' · ');
}

async function renderXlsx(report: ProfitLossReport, locale: keyof typeof labels): Promise<Buffer> {
  const copy = labels[locale];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Aria ERP';
  workbook.created = new Date(report.meta.generatedAt);
  const sheet = workbook.addWorksheet(copy.title, { views: [{ state: 'frozen', ySplit: 4 }] });
  sheet.columns = [
    { key: 'account', width: 38 },
    { key: 'period', width: 18 },
    { key: 'ytd', width: 18 },
    { key: 'comparison', width: 18 },
    { key: 'variance', width: 18 },
  ];
  sheet.mergeCells('A1:E1');
  sheet.getCell('A1').value = copy.title;
  sheet.getCell('A1').font = { bold: true, size: 18 };
  sheet.mergeCells('A2:E2');
  sheet.getCell('A2').value = reportFooter(report);
  sheet.getCell('A2').font = { color: { argb: 'FF6B7280' }, size: 10 };
  sheet.addRow([copy.account, copy.period, copy.ytd, copy.comparison, copy.variance]);
  sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B74E5' } };
  for (const section of report.data.sections) {
    const sectionRow = sheet.addRow([
      section.key.replaceAll('_', ' '),
      Number(section.actualPeriod),
      Number(section.actualYtd),
      Number(section.comparisonYtd),
      Number(section.varianceYtd),
    ]);
    sectionRow.font = { bold: true };
    sectionRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    for (const row of section.rows) {
      sheet.addRow([
        `  ${row.accountCode} · ${row.accountName}`,
        Number(row.actualPeriod),
        Number(row.actualYtd),
        Number(row.comparisonYtd),
        Number(row.varianceYtd),
      ]);
    }
  }
  const total = sheet.addRow([
    'Net profit',
    Number(report.data.totals.actualPeriod),
    Number(report.data.totals.actualYtd),
    Number(report.data.totals.comparisonYtd),
    Number(report.data.totals.varianceYtd),
  ]);
  total.font = { bold: true };
  for (let column = 2; column <= 5; column += 1) {
    sheet.getColumn(column).numFmt = '#,##0.00;[Red](#,##0.00);–';
  }
  sheet.addRow([]);
  sheet.addRow([`${copy.generated}: ${report.meta.generatedAt}`]);
  const result = await workbook.xlsx.writeBuffer();
  return Buffer.from(result);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function renderPdfHtml(report: ProfitLossReport, locale: keyof typeof labels): string {
  const copy = labels[locale];
  const number = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: report.data.presentationCurrency,
    currencyDisplay: 'narrowSymbol',
  });
  const money = (value: string) => {
    const numeric = Number(value);
    return numeric < 0 ? `(${number.format(Math.abs(numeric))})` : number.format(numeric);
  };
  const rows = report.data.sections.map((section) => `
    <tr class="section"><th>${escapeHtml(section.key.replaceAll('_', ' '))}</th>
      <td>${money(section.actualPeriod)}</td><td>${money(section.actualYtd)}</td>
      <td>${money(section.comparisonYtd)}</td><td>${money(section.varianceYtd)}</td></tr>
    ${section.rows.map((row) => `<tr><th>${escapeHtml(`${row.accountCode} · ${row.accountName}`)}</th>
      <td>${money(row.actualPeriod)}</td><td>${money(row.actualYtd)}</td>
      <td>${money(row.comparisonYtd)}</td><td>${money(row.varianceYtd)}</td></tr>`).join('')}
  `).join('');
  return `<!doctype html><html lang="${locale}"><meta charset="utf-8"><style>
    @page{size:A4 landscape;margin:16mm}body{font:12px "Noto Sans","Noto Sans CJK SC",sans-serif;color:#18212f}
    h1{margin:0 0 5px;font-size:22px}.meta{color:#667085;margin-bottom:18px;font-size:10px}
    table{border-collapse:collapse;width:100%}th{text-align:left}td{text-align:right;font-variant-numeric:tabular-nums}
    th,td{padding:7px 9px;border-bottom:1px solid #d8dee8}.section{background:#eff6ff;font-weight:700}
    tfoot{font-weight:700;border-top:2px solid #18212f}.footer{margin-top:16px;color:#667085;font-size:9px}
  </style><body><h1>${escapeHtml(copy.title)}</h1><div class="meta">${escapeHtml(reportFooter(report))}</div>
  <table><thead><tr><th>${escapeHtml(copy.account)}</th><td>${escapeHtml(copy.period)}</td>
  <td>${escapeHtml(copy.ytd)}</td><td>${escapeHtml(copy.comparison)}</td><td>${escapeHtml(copy.variance)}</td></tr></thead>
  <tbody>${rows}</tbody><tfoot><tr><th>Net profit</th><td>${money(report.data.totals.actualPeriod)}</td>
  <td>${money(report.data.totals.actualYtd)}</td><td>${money(report.data.totals.comparisonYtd)}</td>
  <td>${money(report.data.totals.varianceYtd)}</td></tr></tfoot></table>
  <div class="footer">${escapeHtml(reportFooter(report))}</div></body></html>`;
}

async function renderPdf(report: ProfitLossReport, locale: keyof typeof labels): Promise<Buffer> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage();
    await page.setContent(renderPdfHtml(report, locale), { waitUntil: 'load' });
    return Buffer.from(await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
    }));
  } finally {
    await browser.close();
  }
}

async function claimReportJobs(
  db: DB,
  workerId: string,
  batchSize: number,
  now: Date,
  leaseMs: number,
) {
  const expiredLease = new Date(now.getTime() - leaseMs);
  return withReportingWorkerTransaction(db, async (tx) => {
    const rows = await tx.select().from(reportJob).where(and(
      inArray(reportJob.status, ['queued', 'running']),
      lte(reportJob.availableAt, now),
      lt(reportJob.attempts, 3),
      or(
        eq(reportJob.status, 'queued'),
        and(eq(reportJob.status, 'running'), or(
          isNull(reportJob.lockedAt),
          lt(reportJob.lockedAt, expiredLease),
        )),
      ),
    )).orderBy(asc(reportJob.id)).limit(batchSize).for('update', { skipLocked: true });
    if (!rows.length) return rows;
    await tx.update(reportJob).set({
      status: 'running',
      lockedAt: now,
      lockedBy: workerId,
      attempts: sql`${reportJob.attempts} + 1`,
      updatedAt: now,
    }).where(inArray(reportJob.id, rows.map((row) => row.id)));
    return rows;
  });
}

export async function processReportJobBatch(
  db: DB,
  options: {
    workerId?: string;
    batchSize?: number;
    leaseMs?: number;
    now?: Date;
  } = {},
) {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `report-${randomUUID()}`;
  const rows = await claimReportJobs(
    db,
    workerId,
    Math.min(Math.max(options.batchSize ?? 3, 1), 10),
    now,
    options.leaseMs ?? 10 * 60 * 1000,
  );
  let succeeded = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const filters = row.filters as ProfitLossExportFilters;
      const report = await buildProfitLossReport(db, {
        masterFn: row.masterFn,
        activeCompanyFn: row.companyFn,
        actorUserId: row.actorUserId,
        periodId: filters.periodId,
        companyFns: filters.companyFns,
        presentationCurrency: filters.presentationCurrency,
        comparison: filters.comparison,
      }, now);
      const locale = normalizedLocale(row.locale) as keyof typeof labels;
      const content = row.format === 'xlsx'
        ? await renderXlsx(report, locale)
        : await renderPdf(report, locale);
      const mimeType = row.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
      const fileName = `profit-loss-${report.data.period.fiscalYear}-${report.data.period.periodNo}.${row.format}`;
      await withTenantTransaction(db, {
        masterFn: row.masterFn,
        companyFn: row.companyFn,
      }, async (tx) => {
        await tx.insert(reportArtifact).values({
          masterFn: row.masterFn,
          companyFn: row.companyFn,
          jobId: row.id,
          fileName,
          mimeType,
          sha256: createHash('sha256').update(content).digest('hex'),
          sizeBytes: content.byteLength,
          content,
          expiresAt: row.expiresAt,
        });
        await tx.update(reportJob).set({
          status: 'succeeded',
          completedAt: now,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          updatedAt: now,
        }).where(and(eq(reportJob.id, row.id), eq(reportJob.lockedBy, workerId)));
      });
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const finalAttempt = row.attempts + 1 >= 3;
      await withTenantTransaction(db, {
        masterFn: row.masterFn,
        companyFn: row.companyFn,
      }, (tx) => tx.update(reportJob).set({
        status: finalAttempt ? 'failed' : 'queued',
        availableAt: new Date(now.getTime() + Math.min(60_000, 2 ** row.attempts * 1_000)),
        lockedAt: null,
        lockedBy: null,
        lastError: message.slice(0, 1_000),
        completedAt: finalAttempt ? now : null,
        updatedAt: now,
      }).where(and(eq(reportJob.id, row.id), eq(reportJob.lockedBy, workerId))));
      failed += 1;
    }
  }
  return { claimed: rows.length, succeeded, failed };
}
