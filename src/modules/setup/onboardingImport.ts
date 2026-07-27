import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { and, eq, inArray } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  account, customer, glEntry, onboardingImportJob, onboardingImportRow,
  product, stockLevel, stockMovement, supplier, warehouse,
} from '../../data/schema';
import type { SessionData } from '../../auth/session';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { appendAudit } from '../../api/audit';
import { createEmployeeWithin } from '../hr/employee';

export const IMPORT_TARGETS = [
  'employee', 'customer', 'supplier', 'product', 'account', 'warehouse',
  'inventory', 'ar', 'ap', 'gl',
] as const;
export type ImportTarget = typeof IMPORT_TARGETS[number];
export type ImportFormat = 'csv' | 'xlsx';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 25_000;
const ACCOUNT_TYPES = new Set(['asset', 'liability', 'equity', 'income', 'expense']);
const PRODUCT_CATEGORIES = new Set([
  'Components', 'Raw Materials', 'Finished Goods', 'Consumables', 'Packaging',
]);

export class OnboardingImportError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'OnboardingImportError';
  }
}

interface ValidatedRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  warnings: string[];
}

function textValue(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '').trim();
    if ('result' in value) return String(value.result ?? '').trim();
    if ('richText' in value) return value.richText.map((part) => part.text).join('').trim();
  }
  return String(value).trim();
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(value.trim()); value = '';
    } else value += char;
  }
  if (quoted) throw new OnboardingImportError(400, 'invalid_csv', 'CSV contains an unterminated quoted field.');
  values.push(value.trim());
  return values;
}

async function readRows(buffer: Buffer, format: ImportFormat): Promise<Record<string, string>[]> {
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
    throw new OnboardingImportError(413, 'import_file_size', 'Import file must be between 1 byte and 10 MB.');
  }
  let matrix: string[][] = [];
  if (format === 'csv') {
    const body = buffer.toString('utf8').replace(/^\uFEFF/, '');
    matrix = body.split(/\r?\n/).filter((line) => line.trim()).map(parseCsvLine);
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new OnboardingImportError(400, 'empty_workbook', 'Workbook contains no worksheet.');
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values: string[] = [];
      for (let index = 1; index <= row.cellCount; index += 1) {
        values.push(textValue(row.getCell(index).value));
      }
      matrix.push(values);
    });
  }
  if (matrix.length < 2) throw new OnboardingImportError(400, 'empty_import', 'Import requires a header and at least one row.');
  if (matrix.length - 1 > MAX_ROWS) throw new OnboardingImportError(413, 'import_row_limit', `Import supports at most ${MAX_ROWS} rows.`);
  const headers = matrix[0].map((header) => header.trim());
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new OnboardingImportError(400, 'invalid_headers', 'Import headers must be non-empty and unique.');
  }
  return matrix.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index]?.trim() ?? '']),
  ));
}

const TARGET_KEYS: Record<ImportTarget, string> = {
  employee: 'employeeNo', customer: 'code', supplier: 'code', product: 'sku',
  account: 'code', warehouse: 'code', inventory: 'sku', ar: 'reference',
  ap: 'reference', gl: 'journalRef',
};

function required(row: Record<string, string>, fields: string[], errors: string[]) {
  for (const field of fields) if (!row[field]?.trim()) errors.push(`${field}:required`);
}

function positive(value: string, field: string, errors: string[], allowZero = false): number {
  const number = Number(value);
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) errors.push(`${field}:invalid_number`);
  return number;
}

function validateRows(target: ImportTarget, rows: Record<string, string>[]): ValidatedRow[] {
  const seen = new Set<string>();
  return rows.map((data, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const common = (fields: string[]) => required(data, fields, errors);
    if (target === 'employee') {
      common(['employeeNo', 'fullName', 'email', 'department', 'jobTitle', 'startDate', 'baseSalary']);
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('email:invalid');
      if (data.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) errors.push('startDate:invalid');
      if (data.baseSalary) positive(data.baseSalary, 'baseSalary', errors);
    } else if (target === 'customer' || target === 'supplier' || target === 'warehouse') {
      common(['code', 'name']);
    } else if (target === 'product') {
      common(['sku', 'name']);
      if (!data.uom) { data.uom = 'unit'; warnings.push('uom:defaulted'); }
      if (!data.category) { data.category = 'Components'; warnings.push('category:defaulted'); }
      if (!PRODUCT_CATEGORIES.has(data.category)) errors.push('category:invalid');
      if (data.standardCost) positive(data.standardCost, 'standardCost', errors, true);
    } else if (target === 'account') {
      common(['code', 'name', 'type']);
      if (data.type && !ACCOUNT_TYPES.has(data.type)) errors.push('type:invalid');
    } else if (target === 'inventory') {
      common(['sku', 'warehouseCode', 'quantity', 'unitCost']);
      positive(data.quantity, 'quantity', errors, true);
      positive(data.unitCost, 'unitCost', errors, true);
    } else if (target === 'ar' || target === 'ap') {
      common([target === 'ar' ? 'customerCode' : 'supplierCode', 'reference', 'amount', 'controlAccountCode', 'offsetAccountCode']);
      if (data.amount) positive(data.amount, 'amount', errors);
    } else if (target === 'gl') {
      common(['journalRef', 'accountCode']);
      const debit = positive(data.debit || '0', 'debit', errors, true);
      const credit = positive(data.credit || '0', 'credit', errors, true);
      if ((debit > 0) === (credit > 0)) errors.push('debit_credit:one_side_required');
    }
    const key = target === 'inventory'
      ? `${data.sku}|${data.warehouseCode}`
      : target === 'gl'
        ? `${data.journalRef}|${index}`
        : data[TARGET_KEYS[target]]?.toLowerCase();
    if (key && seen.has(key) && target !== 'gl') errors.push(`${TARGET_KEYS[target]}:duplicate_in_file`);
    if (key) seen.add(key);
    return { rowNumber: index + 2, data, errors, warnings };
  });
}

async function validateReferences(
  exec: DB, session: SessionData, target: ImportTarget, rows: ValidatedRow[],
) {
  const scope = and(eq(product.masterFn, session.masterFn), eq(product.companyFn, session.activeCompanyFn));
  if (target === 'inventory') {
    const products = await exec.select({ sku: product.sku }).from(product).where(scope);
    const warehouses = await exec.select({ code: warehouse.code }).from(warehouse).where(and(
      eq(warehouse.masterFn, session.masterFn), eq(warehouse.companyFn, session.activeCompanyFn),
    ));
    const productCodes = new Set(products.map((item) => item.sku));
    const warehouseCodes = new Set(warehouses.map((item) => item.code));
    for (const row of rows) {
      if (!productCodes.has(row.data.sku)) row.errors.push('sku:not_found');
      if (!warehouseCodes.has(row.data.warehouseCode)) row.errors.push('warehouseCode:not_found');
    }
  }
  if (target === 'gl' || target === 'ar' || target === 'ap') {
    const accounts = await exec.select({ code: account.code }).from(account).where(and(
      eq(account.masterFn, session.masterFn), eq(account.companyFn, session.activeCompanyFn),
    ));
    const codes = new Set(accounts.map((item) => item.code));
    for (const row of rows) {
      for (const field of target === 'gl' ? ['accountCode'] : ['controlAccountCode', 'offsetAccountCode']) {
        if (!codes.has(row.data[field])) row.errors.push(`${field}:not_found`);
      }
    }
  }
  if (target === 'ar') {
    const parties = await exec.select({ code: customer.code }).from(customer).where(and(
      eq(customer.masterFn, session.masterFn), eq(customer.companyFn, session.activeCompanyFn),
    ));
    const codes = new Set(parties.map((item) => item.code));
    for (const row of rows) if (!codes.has(row.data.customerCode)) row.errors.push('customerCode:not_found');
  }
  if (target === 'ap') {
    const parties = await exec.select({ code: supplier.code }).from(supplier).where(and(
      eq(supplier.masterFn, session.masterFn), eq(supplier.companyFn, session.activeCompanyFn),
    ));
    const codes = new Set(parties.map((item) => item.code));
    for (const row of rows) if (!codes.has(row.data.supplierCode)) row.errors.push('supplierCode:not_found');
  }
  if (target === 'gl') {
    const totals = new Map<string, { debit: number; credit: number }>();
    for (const row of rows) {
      const value = totals.get(row.data.journalRef) ?? { debit: 0, credit: 0 };
      value.debit += Number(row.data.debit || 0);
      value.credit += Number(row.data.credit || 0);
      totals.set(row.data.journalRef, value);
    }
    for (const row of rows) {
      const total = totals.get(row.data.journalRef)!;
      if (Math.abs(total.debit - total.credit) > 0.005) row.errors.push('journalRef:unbalanced');
    }
  }
}

export async function preflightOnboardingImport(
  db: DB,
  session: SessionData,
  options: { target: string; format: string; fileName: string; buffer: Buffer },
  requestId: string,
) {
  if (!(IMPORT_TARGETS as readonly string[]).includes(options.target)) {
    throw new OnboardingImportError(400, 'invalid_import_target', 'Choose a supported import target.');
  }
  if (options.format !== 'csv' && options.format !== 'xlsx') {
    throw new OnboardingImportError(400, 'invalid_import_format', 'Use CSV or XLSX.');
  }
  const target = options.target as ImportTarget;
  const format = options.format as ImportFormat;
  const sourceHash = createHash('sha256').update(options.buffer).digest('hex');
  const parsed = await readRows(options.buffer, format);
  const validated = validateRows(target, parsed);
  return withTenantTransaction(db, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
  }, async (tx) => {
    const [replay] = await tx.select().from(onboardingImportJob).where(and(
      eq(onboardingImportJob.masterFn, session.masterFn),
      eq(onboardingImportJob.companyFn, session.activeCompanyFn),
      eq(onboardingImportJob.target, target),
      eq(onboardingImportJob.sourceHash, sourceHash),
    )).limit(1);
    if (replay) {
      return { ...replay, replayed: true };
    }
    await validateReferences(tx, session, target, validated);
    const errorRows = validated.filter((row) => row.errors.length).length;
    const warningRows = validated.filter((row) => row.warnings.length).length;
    const [job] = await tx.insert(onboardingImportJob).values({
      masterFn: session.masterFn, companyFn: session.activeCompanyFn,
      target, format, fileName: options.fileName.slice(0, 255) || `import.${format}`,
      sourceHash, status: errorRows ? 'invalid' : 'validated',
      totalRows: validated.length, errorRows, warningRows,
      createdByUserId: session.userId,
    }).returning();
    await tx.insert(onboardingImportRow).values(validated.map((row) => ({
      masterFn: session.masterFn, companyFn: session.activeCompanyFn,
      jobId: job.id, rowNumber: row.rowNumber, normalizedData: row.data,
      errors: row.errors, warnings: row.warnings,
    })));
    await appendAudit(tx, {
      masterFn: session.masterFn, companyFn: session.activeCompanyFn,
      actorUserId: session.userId, requestId,
      entity: 'onboarding_import_job', entityId: job.id, action: 'preflighted',
      after: { target, format, sourceHash, totalRows: validated.length, errorRows, warningRows },
    });
    return { ...job, replayed: false };
  });
}

async function commitRows(
  exec: DB, session: SessionData, target: ImportTarget, rows: Record<string, string>[], jobId: number,
) {
  const tenant = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
  if (target === 'employee') {
    for (const row of rows) {
      await createEmployeeWithin(exec, tenant, {
        employeeNo: row.employeeNo,
        fullName: row.fullName,
        email: row.email.toLowerCase(),
        phone: row.phone || null,
        department: row.department,
        jobTitle: row.jobTitle,
        employmentType: row.employmentType || 'Full-time',
        startDate: row.startDate,
        annualLeaveDays: Number(row.annualLeaveDays || 14),
        baseSalary: row.baseSalary,
      }, session.userId);
    }
  } else if (target === 'customer') {
    await exec.insert(customer).values(rows.map((row) => ({ ...tenant, code: row.code, name: row.name, industry: row.industry || null })));
  } else if (target === 'supplier') {
    await exec.insert(supplier).values(rows.map((row) => ({ ...tenant, code: row.code, name: row.name })));
  } else if (target === 'warehouse') {
    await exec.insert(warehouse).values(rows.map((row) => ({ ...tenant, code: row.code, name: row.name })));
  } else if (target === 'product') {
    await exec.insert(product).values(rows.map((row) => ({
      ...tenant, sku: row.sku, name: row.name, uom: row.uom,
      category: row.category, standardCost: row.standardCost || '0',
      reorderPoint: row.reorderPoint || '0', reorderQty: row.reorderQty || '0',
      trackingType: row.trackingType || 'none',
    })));
  } else if (target === 'account') {
    await exec.insert(account).values(rows.map((row) => ({ ...tenant, code: row.code, name: row.name, type: row.type })));
  } else if (target === 'inventory') {
    const productRows = await exec.select({ id: product.id, sku: product.sku }).from(product).where(and(
      eq(product.masterFn, session.masterFn), eq(product.companyFn, session.activeCompanyFn),
      inArray(product.sku, rows.map((row) => row.sku)),
    ));
    const warehouseRows = await exec.select({ id: warehouse.id, code: warehouse.code }).from(warehouse).where(and(
      eq(warehouse.masterFn, session.masterFn), eq(warehouse.companyFn, session.activeCompanyFn),
      inArray(warehouse.code, rows.map((row) => row.warehouseCode)),
    ));
    const products = new Map(productRows.map((row) => [row.sku, row.id]));
    const warehouses = new Map(warehouseRows.map((row) => [row.code, row.id]));
    for (const row of rows) {
      const productId = products.get(row.sku)!;
      const warehouseId = warehouses.get(row.warehouseCode)!;
      await exec.insert(stockLevel).values({ ...tenant, productId, warehouseId, qty: row.quantity });
      if (Number(row.quantity) > 0) await exec.insert(stockMovement).values({
        ...tenant, productId, warehouseId, qty: row.quantity, direction: 'in',
        movementGroup: `ONBOARDING-${jobId}`, refType: 'opening_inventory', refId: jobId,
      });
    }
  } else {
    const accountRows = await exec.select({ id: account.id, code: account.code }).from(account).where(and(
      eq(account.masterFn, session.masterFn), eq(account.companyFn, session.activeCompanyFn),
    ));
    const accounts = new Map(accountRows.map((row) => [row.code, row.id]));
    const legs = target === 'gl' ? rows.flatMap((row) => [{
      ...tenant, journalRef: row.journalRef, accountId: accounts.get(row.accountCode)!,
      debit: row.debit || '0', credit: row.credit || '0', memo: row.memo || 'Opening balance import',
    }]) : rows.flatMap((row) => {
      const amount = row.amount;
      const ar = target === 'ar';
      return [
        { ...tenant, journalRef: row.reference, accountId: accounts.get(row.controlAccountCode)!, debit: ar ? amount : '0', credit: ar ? '0' : amount, memo: `${target.toUpperCase()} opening` },
        { ...tenant, journalRef: row.reference, accountId: accounts.get(row.offsetAccountCode)!, debit: ar ? '0' : amount, credit: ar ? amount : '0', memo: `${target.toUpperCase()} opening offset` },
      ];
    });
    await exec.insert(glEntry).values(legs);
  }
}

export function commitOnboardingImport(
  db: DB,
  session: SessionData,
  jobId: number,
  expectedVersion: number,
  confirmWarnings: boolean,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
  }, async (tx) => {
    const [job] = await tx.select().from(onboardingImportJob).where(and(
      eq(onboardingImportJob.id, jobId),
      eq(onboardingImportJob.masterFn, session.masterFn),
      eq(onboardingImportJob.companyFn, session.activeCompanyFn),
    )).limit(1).for('update');
    if (!job) throw new OnboardingImportError(404, 'import_job_not_found', 'Import job was not found.');
    if (job.status === 'committed') return { ...job, replayed: true };
    if (job.status !== 'validated' || job.errorRows > 0) {
      throw new OnboardingImportError(422, 'import_has_errors', 'Fix every import error before committing.');
    }
    if (job.warningRows > 0 && !confirmWarnings) {
      throw new OnboardingImportError(409, 'import_warnings_unconfirmed', 'Confirm import warnings before committing.');
    }
    if (job.version !== expectedVersion) {
      throw new OnboardingImportError(409, 'version_conflict', 'Reload the import job and try again.');
    }
    const staged = await tx.select({ data: onboardingImportRow.normalizedData })
      .from(onboardingImportRow).where(and(
        eq(onboardingImportRow.masterFn, session.masterFn),
        eq(onboardingImportRow.companyFn, session.activeCompanyFn),
        eq(onboardingImportRow.jobId, jobId),
      )).orderBy(onboardingImportRow.rowNumber);
    await commitRows(tx, session, job.target as ImportTarget, staged.map((row) => row.data as Record<string, string>), jobId);
    const now = new Date();
    const [updated] = await tx.update(onboardingImportJob).set({
      status: 'committed', importedRows: job.totalRows, committedAt: now,
      version: job.version + 1, updatedAt: now,
    }).where(eq(onboardingImportJob.id, job.id)).returning();
    await appendAudit(tx, {
      masterFn: session.masterFn, companyFn: session.activeCompanyFn,
      actorUserId: session.userId, requestId,
      entity: 'onboarding_import_job', entityId: job.id, action: 'committed',
      after: { target: job.target, importedRows: job.totalRows, sourceHash: job.sourceHash },
    });
    return { ...updated, replayed: false };
  });
}
