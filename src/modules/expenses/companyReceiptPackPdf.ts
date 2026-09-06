import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import {
  renderEvidencePdf,
  type EvidencePdfDocument,
} from '../documents/evidencePdf';

export interface CompanyReceiptPackFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
}

export interface CompanyReceiptPackTotal {
  currency: string;
  amount: string;
  receiptCount: number;
}

export interface CompanyReceiptPackLineFacts {
  receiptId: number;
  receiptVersion: number;
  transactionDate: string;
  merchant: string;
  receiptNumber: string | null;
  category: string;
  businessPurpose: string;
  notes: string | null;
  amount: string;
  currency: string;
  uploaderUserId: number;
  uploaderName: string | null;
  documentId: number;
  documentVersionId: number;
  documentSha256: string;
  originalFileName: string;
}

export interface CompanyReceiptPackFacts {
  id: number;
  packKey: string;
  locale: string;
  filters: CompanyReceiptPackFilters;
  rows: CompanyReceiptPackLineFacts[];
  totals: CompanyReceiptPackTotal[];
  sourceSha256: string;
  rowCount: number;
  documentCount: number;
  createdAt: Date | string;
}

type ReceiptPackLocale = 'en' | 'ms' | 'zh' | 'ja' | 'vi';

interface ReceiptPackCopy {
  title: string;
  period: string;
  receipts: string;
  documents: string;
  totalsByCurrency: string;
  sourceSha256: string;
  date: string;
  merchantReceipt: string;
  categoryPurpose: string;
  uploader: string;
  amount: string;
}

const COPY: Record<ReceiptPackLocale, ReceiptPackCopy> = {
  en: {
    title: 'Company Receipt Pack',
    period: 'Period',
    receipts: 'Receipts',
    documents: 'Documents',
    totalsByCurrency: 'Totals by currency',
    sourceSha256: 'Source SHA-256',
    date: 'Date',
    merchantReceipt: 'Merchant / Receipt',
    categoryPurpose: 'Category / Purpose',
    uploader: 'Uploader',
    amount: 'Amount',
  },
  ms: {
    title: 'Pek Resit Syarikat',
    period: 'Tempoh',
    receipts: 'Resit',
    documents: 'Dokumen',
    totalsByCurrency: 'Jumlah mengikut mata wang',
    sourceSha256: 'SHA-256 Sumber',
    date: 'Tarikh',
    merchantReceipt: 'Peniaga / Resit',
    categoryPurpose: 'Kategori / Tujuan',
    uploader: 'Pemuat naik',
    amount: 'Amaun',
  },
  zh: {
    title: '公司收据包',
    period: '期间',
    receipts: '收据',
    documents: '文档',
    totalsByCurrency: '按货币汇总',
    sourceSha256: '来源 SHA-256',
    date: '日期',
    merchantReceipt: '商户 / 收据',
    categoryPurpose: '类别 / 用途',
    uploader: '上传者',
    amount: '金额',
  },
  ja: {
    title: '会社領収書パック',
    period: '期間',
    receipts: '領収書',
    documents: '書類',
    totalsByCurrency: '通貨別合計',
    sourceSha256: 'ソース SHA-256',
    date: '日付',
    merchantReceipt: '加盟店 / 領収書',
    categoryPurpose: 'カテゴリ / 目的',
    uploader: 'アップロード者',
    amount: '金額',
  },
  vi: {
    title: 'Gói biên lai công ty',
    period: 'Khoảng thời gian',
    receipts: 'Biên lai',
    documents: 'Tài liệu',
    totalsByCurrency: 'Tổng theo tiền tệ',
    sourceSha256: 'SHA-256 nguồn',
    date: 'Ngày',
    merchantReceipt: 'Người bán / Biên lai',
    categoryPurpose: 'Danh mục / Mục đích',
    uploader: 'Người tải lên',
    amount: 'Số tiền',
  },
};

const REGULAR_FONT_URL = new URL(
  '../../assets/fonts/NotoSansCJKsc-Regular.ttf',
  import.meta.url,
);

async function loadRegularFontBytes(url: URL): Promise<Uint8Array> {
  const nodeProcess = (globalThis as typeof globalThis & {
    process?: {
      getBuiltinModule?: (id: string) => unknown;
      versions?: { node?: string };
    };
  }).process;
  const fs = nodeProcess?.getBuiltinModule?.('fs/promises') as {
    readFile(path: URL): Promise<Uint8Array>;
  } | undefined;
  if (fs) return fs.readFile(url);
  if (nodeProcess?.versions?.node) {
    const nodeFs = await import('node:fs/promises');
    return nodeFs.readFile(url);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load Receipt Pack font (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

const regularFontBytes = loadRegularFontBytes(REGULAR_FONT_URL);

function copyFor(locale: string): ReceiptPackCopy {
  return COPY[locale as ReceiptPackLocale] ?? COPY.en;
}

function singleLine(value: unknown): string {
  return [...String(value ?? '')]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code === 127 ? ' ' : character;
    })
    .join('');
}

async function renderRegister(pack: CompanyReceiptPackFacts): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const createdAt = new Date(pack.createdAt);
  const copy = copyFor(pack.locale);
  pdf.setTitle(copy.title);
  pdf.setAuthor('Aria ERP');
  pdf.setSubject('Receipt Pack ' + pack.id + ' ' + pack.sourceSha256);
  pdf.setCreationDate(createdAt);
  pdf.setModificationDate(createdAt);
  const font = await pdf.embedFont(await regularFontBytes);
  const bold = font;
  let page = pdf.addPage([842, 595]);
  let y = 560;
  const drawHeading = () => {
    page.drawText(copy.title, {
      x: 32, y, size: 18, font: bold, color: rgb(0.04, 0.29, 0.62),
    });
    y -= 20;
    page.drawText(
      singleLine(
        copy.period + ' ' + pack.filters.dateFrom + ' to ' + pack.filters.dateTo
          + ' | ' + copy.receipts + ' ' + pack.rowCount
          + ' | ' + copy.documents + ' ' + pack.documentCount,
      ),
      { x: 32, y, size: 8, font },
    );
    y -= 14;
    const totals = pack.totals
      .map((total) => total.currency + ' ' + total.amount + ' (' + total.receiptCount + ')')
      .join(' | ');
    page.drawText(singleLine(copy.totalsByCurrency + ': ' + totals), {
      x: 32, y, size: 8, font: bold,
    });
    y -= 14;
    page.drawText(singleLine(copy.sourceSha256 + ' ' + pack.sourceSha256), {
      x: 32, y, size: 7, font, color: rgb(0.35, 0.39, 0.45),
    });
    y -= 20;
    page.drawText(copy.date, { x: 32, y, size: 8, font: bold });
    page.drawText(copy.merchantReceipt, { x: 105, y, size: 8, font: bold });
    page.drawText(copy.categoryPurpose, { x: 340, y, size: 8, font: bold });
    page.drawText(copy.uploader, { x: 565, y, size: 8, font: bold });
    page.drawText(copy.amount, { x: 735, y, size: 8, font: bold });
    y -= 13;
  };
  drawHeading();
  for (const row of pack.rows) {
    if (y < 48) {
      page = pdf.addPage([842, 595]);
      y = 560;
      drawHeading();
    }
    page.drawText(singleLine(row.transactionDate), { x: 32, y, size: 7, font });
    page.drawText(singleLine(
      row.merchant + ' | ' + (row.receiptNumber ?? '-'),
    ).slice(0, 52), {
      x: 105, y, size: 7, font: bold,
    });
    page.drawText(singleLine(
      row.category + ' | ' + row.businessPurpose,
    ).slice(0, 49), {
      x: 340, y, size: 7, font,
    });
    page.drawText(singleLine(
      row.uploaderName ?? ('User ' + row.uploaderUserId),
    ).slice(0, 27), {
      x: 565, y, size: 7, font,
    });
    page.drawText(singleLine(row.amount + ' ' + row.currency), {
      x: 735, y, size: 7, font,
    });
    y -= 12;
  }
  return pdf.save({ useObjectStreams: false });
}

export async function renderCompanyReceiptPackPdf(
  pack: CompanyReceiptPackFacts,
  documents: EvidencePdfDocument[],
): Promise<Uint8Array> {
  const register = await renderRegister(pack);
  const copy = copyFor(pack.locale);
  return renderEvidencePdf({
    title: copy.title,
    createdAt: new Date(pack.createdAt),
    leadingPdf: register,
    fontBytes: await regularFontBytes,
  }, documents);
}
