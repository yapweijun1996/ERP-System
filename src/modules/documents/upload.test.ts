import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { appUser, documentVersion, managedDocument } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  listReceiptDocuments,
  RECEIPT_UPLOAD_MAX_BYTES,
  uploadReceiptDocument,
  validateReceiptUpload,
} from './upload';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

async function pdfWithPages(count: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let page = 0; page < count; page += 1) pdf.addPage([100, 100]);
  return pdf.save({ useObjectStreams: false });
}

function jpegBytes(): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}

function pngBytes(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
  ]);
}

function heicBytes(): Uint8Array {
  return Uint8Array.from([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x68, 0x65, 0x69, 0x63,
    0x00, 0x00, 0x00, 0x00,
    0x6d, 0x69, 0x66, 0x31,
    0x68, 0x65, 0x69, 0x63,
  ]);
}

describe('secure receipt upload', () => {
  it('accepts supported magic bytes and counts a 20-page PDF', async () => {
    await expect(validateReceiptUpload({
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpegBytes(),
    })).resolves.toMatchObject({ format: 'jpeg', pageCount: 1 });
    await expect(validateReceiptUpload({
      fileName: 'receipt.png',
      declaredMimeType: 'image/png',
      content: pngBytes(),
    })).resolves.toMatchObject({ format: 'png', pageCount: 1 });
    await expect(validateReceiptUpload({
      fileName: 'receipt.heic',
      declaredMimeType: 'image/heic',
      content: heicBytes(),
    })).resolves.toMatchObject({ format: 'heic', pageCount: 1 });
    await expect(validateReceiptUpload({
      fileName: 'receipt.pdf',
      declaredMimeType: 'application/pdf',
      content: await pdfWithPages(20),
    })).resolves.toMatchObject({ format: 'pdf', pageCount: 20 });
  });

  it('rejects MIME/extension spoofing, malformed PDFs and more than 20 pages', async () => {
    await expect(validateReceiptUpload({
      fileName: 'receipt.pdf',
      declaredMimeType: 'application/pdf',
      content: jpegBytes(),
    })).rejects.toMatchObject({ code: 'receipt_type_mismatch', status: 422 });
    await expect(validateReceiptUpload({
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/png',
      content: jpegBytes(),
    })).rejects.toMatchObject({ code: 'receipt_type_mismatch', status: 422 });
    await expect(validateReceiptUpload({
      fileName: 'receipt.pdf',
      declaredMimeType: 'application/pdf',
      content: new TextEncoder().encode('%PDF-not-valid'),
    })).rejects.toMatchObject({ code: 'receipt_pdf_invalid', status: 422 });
    await expect(validateReceiptUpload({
      fileName: 'receipt.pdf',
      declaredMimeType: 'application/pdf',
      content: await pdfWithPages(21),
    })).rejects.toMatchObject({ code: 'receipt_pdf_page_limit', status: 413 });
  });

  it('enforces the exact 20 MB content boundary before storage', async () => {
    const tooLarge = new Uint8Array(RECEIPT_UPLOAD_MAX_BYTES + 1);
    tooLarge.set(jpegBytes());
    await expect(validateReceiptUpload({
      fileName: 'large.jpg',
      declaredMimeType: 'image/jpeg',
      content: tooLarge,
    })).rejects.toMatchObject({ code: 'receipt_too_large', status: 413 });
  });

  it('stores actor-owned receipt metadata idempotently and lists no other owner', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const input = {
      clientDraftId: 'draft_secure_001',
      fileName: 'taxi.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpegBytes(),
      retentionUntil: new Date('2033-12-31T00:00:00.000Z'),
    };
    const created = await uploadReceiptDocument(
      db, scope, { userId: viewer.userId }, input,
    );
    const replayed = await uploadReceiptDocument(
      db, scope, { userId: viewer.userId }, input,
    );
    expect(created.replayed).toBe(false);
    expect(replayed.replayed).toBe(true);
    expect(created.version).toMatchObject({
      pageCount: 1,
      mimeType: 'image/jpeg',
      storageBackend: 'database',
    });
    expect(await db.select().from(managedDocument)).toHaveLength(1);
    expect(await db.select().from(documentVersion)).toHaveLength(1);
    expect(await listReceiptDocuments(
      db, scope, { userId: viewer.userId },
    )).toHaveLength(1);
    expect(await listReceiptDocuments(
      db, scope, { userId: admin.userId },
    )).toHaveLength(0);
  });
});
