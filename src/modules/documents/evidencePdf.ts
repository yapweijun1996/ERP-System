import { PDFDocument, StandardFonts } from 'pdf-lib';

export interface EvidencePdfDocument {
  fileName: string;
  mimeType: string;
  sha256: string;
  content: Uint8Array;
}

export interface EvidencePdfOptions {
  title: string;
  createdAt: Date;
  leadingPdf?: Uint8Array;
  emptyMessage?: string;
}

function printable(value: string): string {
  return [...value].map((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 && code <= 126 ? character : '?';
  }).join('');
}

function wrapText(value: string, width: number): string[] {
  const result: string[] = [];
  let remaining = printable(value);
  while (remaining.length > width) {
    result.push(remaining.slice(0, width));
    remaining = remaining.slice(width);
  }
  result.push(remaining);
  return result;
}

async function placeholderEvidencePage(
  pdf: PDFDocument,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  document: Pick<EvidencePdfDocument, 'fileName' | 'mimeType' | 'sha256'>,
  message = 'Original evidence format cannot be embedded in this PDF.',
) {
  const page = pdf.addPage([595, 842]);
  page.drawText(printable(message), { x: 45, y: 785, size: 14, font });
  let y = 750;
  for (const line of wrapText(`File: ${document.fileName}`, 75)) {
    page.drawText(line, { x: 45, y, size: 10, font });
    y -= 15;
  }
  page.drawText(printable(`MIME: ${document.mimeType}`), { x: 45, y, size: 10, font });
  y -= 18;
  for (const line of wrapText(`SHA-256: ${document.sha256}`, 75)) {
    page.drawText(line, { x: 45, y, size: 9, font });
    y -= 14;
  }
}

/** Compose an optional register PDF followed by each original in input order.
 * Multi-page PDFs are copied without rasterisation; JPEG/PNG images are scaled
 * onto A4 portrait pages. Unsupported or corrupt formats receive an explicit
 * identity page rather than silently disappearing. */
export async function renderEvidencePdf(
  options: EvidencePdfOptions,
  documents: EvidencePdfDocument[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(options.title);
  pdf.setAuthor('Aria ERP');
  pdf.setCreationDate(options.createdAt);
  pdf.setModificationDate(options.createdAt);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  if (options.leadingPdf) {
    const leading = await PDFDocument.load(options.leadingPdf, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
    });
    const pages = await pdf.copyPages(leading, leading.getPageIndices());
    pages.forEach((page) => pdf.addPage(page));
  }

  for (const document of documents) {
    try {
      if (document.mimeType === 'application/pdf') {
        const source = await PDFDocument.load(document.content, {
          ignoreEncryption: false,
          throwOnInvalidObject: true,
        });
        const pages = await pdf.copyPages(source, source.getPageIndices());
        pages.forEach((page) => pdf.addPage(page));
      } else if (document.mimeType === 'image/png') {
        const image = await pdf.embedPng(document.content);
        const size = image.scale(Math.min(1, 520 / image.width, 750 / image.height));
        const page = pdf.addPage([595, 842]);
        page.drawImage(image, {
          x: (595 - size.width) / 2,
          y: (842 - size.height) / 2,
          width: size.width,
          height: size.height,
        });
      } else if (document.mimeType === 'image/jpeg') {
        const image = await pdf.embedJpg(document.content);
        const size = image.scale(Math.min(1, 520 / image.width, 750 / image.height));
        const page = pdf.addPage([595, 842]);
        page.drawImage(image, {
          x: (595 - size.width) / 2,
          y: (842 - size.height) / 2,
          width: size.width,
          height: size.height,
        });
      } else {
        await placeholderEvidencePage(pdf, font, document);
      }
    } catch {
      await placeholderEvidencePage(
        pdf,
        font,
        document,
        'Original evidence could not be embedded; identity is preserved below.',
      );
    }
  }

  if (!pdf.getPageCount()) {
    await placeholderEvidencePage(pdf, font, {
      fileName: 'No evidence',
      mimeType: 'application/octet-stream',
      sha256: '0'.repeat(64),
    }, options.emptyMessage ?? 'No evidence was supplied.');
  }
  return pdf.save({ useObjectStreams: false });
}
