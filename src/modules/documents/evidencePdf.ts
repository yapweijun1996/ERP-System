import { PDFDocument, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { receiptPdfFontFeatures, savePdfWithOpenTypeFonts } from './pdfFont';

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
  fontBytes?: Uint8Array;
}

// A source with a one-pixel edge cannot contain readable receipt evidence. Keep
// the original bytes governed by document storage, but make the generated Pack
// explain why the source image is not rendered as a nearly blank page.
const MIN_RENDERABLE_IMAGE_DIMENSION = 2;

function printable(value: string, unicode = false): string {
  if (unicode) {
    return [...value].filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 32 && code !== 127;
    }).join('');
  }
  return [...value].map((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 && code <= 126 ? character : '?';
  }).join('');
}

function wrapText(value: string, width: number, unicode = false): string[] {
  const result: string[] = [];
  let remaining = printable(value, unicode);
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
  unicode = false,
) {
  const page = pdf.addPage([595, 842]);
  let y = 785;
  for (const line of wrapText(message, 60, unicode)) {
    page.drawText(line, { x: 45, y, size: 14, font });
    y -= 20;
  }
  y -= 5;
  for (const line of wrapText(`File: ${document.fileName}`, 75, unicode)) {
    page.drawText(line, { x: 45, y, size: 10, font });
    y -= 15;
  }
  page.drawText(printable(`MIME: ${document.mimeType}`, unicode), { x: 45, y, size: 10, font });
  y -= 18;
  for (const line of wrapText(`SHA-256: ${document.sha256}`, 75, unicode)) {
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
  if (options.fontBytes) pdf.registerFontkit(fontkit);
  const unicode = Boolean(options.fontBytes);
  let font: Awaited<ReturnType<PDFDocument['embedFont']>> | null = null;
  const getFont = async () => font ??= await pdf.embedFont(
    options.fontBytes ?? StandardFonts.Helvetica,
    { features: { ...receiptPdfFontFeatures } },
  );

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
        if (image.width < MIN_RENDERABLE_IMAGE_DIMENSION
          || image.height < MIN_RENDERABLE_IMAGE_DIMENSION) {
          await placeholderEvidencePage(
            pdf,
            await getFont(),
            document,
            'Source image is too small; identity is preserved below.',
            unicode,
          );
          continue;
        }
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
        if (image.width < MIN_RENDERABLE_IMAGE_DIMENSION
          || image.height < MIN_RENDERABLE_IMAGE_DIMENSION) {
          await placeholderEvidencePage(
            pdf,
            await getFont(),
            document,
            'Source image is too small; identity is preserved below.',
            unicode,
          );
          continue;
        }
        const size = image.scale(Math.min(1, 520 / image.width, 750 / image.height));
        const page = pdf.addPage([595, 842]);
        page.drawImage(image, {
          x: (595 - size.width) / 2,
          y: (842 - size.height) / 2,
          width: size.width,
          height: size.height,
        });
      } else {
        await placeholderEvidencePage(pdf, await getFont(), document, undefined, unicode);
      }
    } catch {
      await placeholderEvidencePage(
        pdf,
        await getFont(),
        document,
        'Original evidence could not be embedded; identity is preserved below.',
        unicode,
      );
    }
  }

  if (!pdf.getPageCount()) {
    await placeholderEvidencePage(pdf, await getFont(), {
      fileName: 'No evidence',
      mimeType: 'application/octet-stream',
      sha256: '0'.repeat(64),
    }, options.emptyMessage ?? 'No evidence was supplied.', unicode);
  }
  return savePdfWithOpenTypeFonts(pdf, font ? [font] : []);
}
