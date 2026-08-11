import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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

function printable(value: unknown): string {
  return [...String(value ?? '')].map((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 && code <= 126 ? character : '?';
  }).join('');
}

async function renderRegister(pack: CompanyReceiptPackFacts): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const createdAt = new Date(pack.createdAt);
  pdf.setTitle('Company Receipt Pack');
  pdf.setAuthor('Aria ERP');
  pdf.setSubject(`Receipt Pack ${pack.id} ${pack.sourceSha256}`);
  pdf.setCreationDate(createdAt);
  pdf.setModificationDate(createdAt);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([842, 595]);
  let y = 560;
  const drawHeading = () => {
    page.drawText('Company Receipt Pack', {
      x: 32, y, size: 18, font: bold, color: rgb(0.04, 0.29, 0.62),
    });
    y -= 20;
    page.drawText(
      printable(`Period ${pack.filters.dateFrom} to ${pack.filters.dateTo} | Receipts ${pack.rowCount} | Documents ${pack.documentCount}`),
      { x: 32, y, size: 8, font },
    );
    y -= 14;
    const totals = pack.totals
      .map((total) => `${total.currency} ${total.amount} (${total.receiptCount})`)
      .join(' | ');
    page.drawText(printable(`Totals by currency: ${totals}`), { x: 32, y, size: 8, font: bold });
    y -= 14;
    page.drawText(printable(`Source SHA-256 ${pack.sourceSha256}`), {
      x: 32, y, size: 7, font, color: rgb(0.35, 0.39, 0.45),
    });
    y -= 20;
    page.drawText('Date', { x: 32, y, size: 8, font: bold });
    page.drawText('Merchant / Receipt', { x: 105, y, size: 8, font: bold });
    page.drawText('Category / Purpose', { x: 340, y, size: 8, font: bold });
    page.drawText('Uploader', { x: 565, y, size: 8, font: bold });
    page.drawText('Amount', { x: 735, y, size: 8, font: bold });
    y -= 13;
  };
  drawHeading();
  for (const row of pack.rows) {
    if (y < 48) {
      page = pdf.addPage([842, 595]);
      y = 560;
      drawHeading();
    }
    page.drawText(printable(row.transactionDate), { x: 32, y, size: 7, font });
    page.drawText(printable(`${row.merchant} | ${row.receiptNumber ?? '-'}`).slice(0, 52), {
      x: 105, y, size: 7, font: bold,
    });
    page.drawText(printable(`${row.category} | ${row.businessPurpose}`).slice(0, 49), {
      x: 340, y, size: 7, font,
    });
    page.drawText(printable(row.uploaderName ?? `User ${row.uploaderUserId}`).slice(0, 27), {
      x: 565, y, size: 7, font,
    });
    page.drawText(printable(`${row.amount} ${row.currency}`), { x: 735, y, size: 7, font });
    y -= 12;
  }
  return pdf.save({ useObjectStreams: false });
}

export async function renderCompanyReceiptPackPdf(
  pack: CompanyReceiptPackFacts,
  documents: EvidencePdfDocument[],
): Promise<Uint8Array> {
  const register = await renderRegister(pack);
  return renderEvidencePdf({
    title: 'Company Receipt Pack',
    createdAt: new Date(pack.createdAt),
    leadingPdf: register,
  }, documents);
}
