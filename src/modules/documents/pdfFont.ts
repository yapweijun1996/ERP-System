import { PDFArray, PDFDict, PDFName, PDFRawStream, decodePDFRawStream, type PDFDocument, type PDFFont } from 'pdf-lib';

// Localized alternate digits/ligatures are absent from pdf-lib's full-font Unicode map.
export const receiptPdfFontFeatures = { locl: false, liga: false };

/** Correct only fonts owned by this renderer; imported source pages remain untouched. */
export async function savePdfWithOpenTypeFonts(pdf: PDFDocument, fonts: readonly PDFFont[]): Promise<Uint8Array> {
  await pdf.flush();
  for (const font of fonts) {
    const dictionary = pdf.context.lookup(font.ref, PDFDict);
    const descendants = dictionary.lookupMaybe(PDFName.of('DescendantFonts'), PDFArray);
    if (!descendants) continue;
    const descendant = descendants.lookup(0, PDFDict);
    const descriptor = descendant.lookup(PDFName.of('FontDescriptor'), PDFDict);
    const streamReference = descriptor.get(PDFName.of('FontFile2')) ?? descriptor.get(PDFName.of('FontFile3'));
    const stream = pdf.context.lookup(streamReference);
    if (!(stream instanceof PDFRawStream)) continue;
    const bytes = decodePDFRawStream(stream).decode();
    // This fontkit exposes "CFF ", while pdf-lib checks `cff` and mislabels it as TrueType.
    if (bytes[0] === 0x4f && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4f) {
      descendant.set(PDFName.of('Subtype'), PDFName.of('CIDFontType0'));
      descriptor.delete(PDFName.of('FontFile2'));
      descriptor.set(PDFName.of('FontFile3'), streamReference!);
      stream.dict.set(PDFName.of('Subtype'), PDFName.of('OpenType'));
    }
  }
  return pdf.save({ useObjectStreams: false });
}
