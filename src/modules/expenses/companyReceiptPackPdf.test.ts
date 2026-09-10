import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { receiptPdfFontFeatures } from '../documents/pdfFont';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { renderCompanyReceiptPackPdf, wrapReceiptPackText, type CompanyReceiptPackFacts } from './companyReceiptPackPdf';

const fontBytes = readFile(new URL('../../assets/fonts/NotoSansCJKsc-Regular.ttf', import.meta.url));
const facts: CompanyReceiptPackFacts = {
  id: 1, packKey: 'render_test', locale: 'en', filters: { search: '', dateFrom: '2026-09-01', dateTo: '2026-09-30' },
  rows: [], totals: [], sourceSha256: 'a'.repeat(64), rowCount: 0, documentCount: 0, createdAt: '2026-09-09T00:00:00Z',
};

describe('Receipt Pack PDF fidelity', () => {
  it.each(['Long merchant name '.repeat(40), '公司收据用途'.repeat(50), '領収書の確認'.repeat(50), 'Mục đích chuyến đi '.repeat(40)])('preserves complete text inside column width', async (value) => {
    const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(await fontBytes, { subset: true });
    const lines = wrapReceiptPackText(value, font, 7, 100);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe(value);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 7)).toBeLessThanOrEqual(100);
  });

  it('keeps digits mapped identically inside currency and date labels', async () => {
    const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(await fontBytes, { features: { ...receiptPdfFontFeatures } });
    const digits = font.encodeText('18.2500').toString().slice(1, -1);
    expect(font.encodeText('18.2500 SGD').toString()).toContain(digits);
    expect(font.encodeText('Period 2026-09-01').toString()).toContain(font.encodeText('2026-09-01').toString().slice(1, -1));
  });

  it('declares complete OpenType containers for register and unsupported-source identity page', async () => {
    const content = await renderCompanyReceiptPackPdf(facts, [{ fileName: '收据.txt', mimeType: 'text/plain', sha256: 'b'.repeat(64), content: new Uint8Array() }]);
    const pdf = await PDFDocument.load(content);
    expect(pdf.getPageCount()).toBe(2);
    const streams = pdf.context.enumerateIndirectObjects().map(([, object]) => object)
      .filter((object): object is PDFRawStream => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype'))?.toString() === '/OpenType');
    expect(streams).toHaveLength(2);
    for (const stream of streams) {
      const bytes = decodePDFRawStream(stream).decode();
      expect(Array.from(bytes.subarray(0, 4))).toEqual([0x4f, 0x54, 0x54, 0x4f]);
    }
  });

  it('continues a very long row across pages and renders the same frozen facts deterministically', async () => {
    const pack = { ...facts, rowCount: 1, rows: [{
      receiptId: 1, receiptVersion: 1, transactionDate: '2026-09-01', merchant: 'Synthetic', receiptNumber: 'R-1',
      category: 'Travel', businessPurpose: 'Complete business purpose '.repeat(150), notes: null, amount: '18.2500', currency: 'SGD',
      uploaderUserId: 1, uploaderName: 'Admin', documentId: 1, documentVersionId: 1, documentSha256: 'b'.repeat(64), originalFileName: 'receipt.pdf',
    }] };
    const first = await renderCompanyReceiptPackPdf(pack, []);
    const second = await renderCompanyReceiptPackPdf(pack, []);
    expect(createHash('sha256').update(first).digest('hex')).toBe(createHash('sha256').update(second).digest('hex'));
    expect((await PDFDocument.load(first)).getPageCount()).toBeGreaterThan(1);
  });
});
