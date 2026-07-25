import { PDFDocument } from 'pdf-lib';

export const RECEIPT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const RECEIPT_UPLOAD_MAX_PDF_PAGES = 20;

export type ReceiptUploadFormat = 'jpeg' | 'png' | 'heic' | 'pdf';

export interface ValidatedReceiptUpload {
  content: Uint8Array;
  fileName: string;
  format: ReceiptUploadFormat;
  mimeType: 'image/jpeg' | 'image/png' | 'image/heic' | 'image/heif' | 'application/pdf';
  pageCount: number;
}

export interface ReceiptContentInput {
  fileName: string;
  declaredMimeType: string;
  content: Uint8Array;
}

export class ReceiptUploadError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = 'ReceiptUploadError';
  }
}

const FORMAT_RULES = {
  jpeg: {
    extensions: new Set(['.jpg', '.jpeg']),
    mimeTypes: new Set(['image/jpeg']),
  },
  png: {
    extensions: new Set(['.png']),
    mimeTypes: new Set(['image/png']),
  },
  heic: {
    extensions: new Set(['.heic', '.heif']),
    mimeTypes: new Set(['image/heic', 'image/heif']),
  },
  pdf: {
    extensions: new Set(['.pdf']),
    mimeTypes: new Set(['application/pdf']),
  },
} satisfies Record<ReceiptUploadFormat, {
  extensions: Set<string>;
  mimeTypes: Set<string>;
}>;

function uploadError(code: string, message: string, status = 422): never {
  throw new ReceiptUploadError(code, message, status);
}

function bytesEqual(content: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => content[offset + index] === value);
}

function ascii(content: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...content.subarray(start, start + length));
}

function extension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot).toLowerCase();
}

function detectFormat(content: Uint8Array): {
  format: ReceiptUploadFormat;
  mimeType: ValidatedReceiptUpload['mimeType'];
} {
  if (content.byteLength >= 4 && bytesEqual(content, [0xff, 0xd8, 0xff])) {
    return { format: 'jpeg', mimeType: 'image/jpeg' };
  }
  if (
    content.byteLength >= 8
    && bytesEqual(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return { format: 'png', mimeType: 'image/png' };
  }
  if (content.byteLength >= 12 && ascii(content, 4, 4) === 'ftyp') {
    const boxSize = (
      content[0] * 0x1000000
      + content[1] * 0x10000
      + content[2] * 0x100
      + content[3]
    );
    if (boxSize >= 12 && boxSize <= content.byteLength) {
      const brands: string[] = [];
      for (let offset = 8; offset + 4 <= Math.min(boxSize, 64); offset += 4) {
        brands.push(ascii(content, offset, 4));
      }
      if (brands.some((brand) => ['heic', 'heix', 'hevc', 'hevx'].includes(brand))) {
        return { format: 'heic', mimeType: 'image/heic' };
      }
      if (brands.some((brand) => ['mif1', 'msf1'].includes(brand))) {
        return { format: 'heic', mimeType: 'image/heif' };
      }
    }
  }
  if (content.byteLength >= 5 && ascii(content, 0, 5) === '%PDF-') {
    return { format: 'pdf', mimeType: 'application/pdf' };
  }
  return uploadError(
    'receipt_content_type_unsupported',
    'Receipt content is not a supported JPEG, PNG, HEIC or PDF file.',
  );
}

async function pdfPageCount(content: Uint8Array): Promise<number> {
  try {
    const document = await PDFDocument.load(content, {
      ignoreEncryption: false,
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
    return document.getPageCount();
  } catch {
    return uploadError(
      'receipt_pdf_invalid',
      'The PDF is malformed, encrypted or cannot be safely counted.',
    );
  }
}

export async function validateReceiptUpload(
  input: ReceiptContentInput,
): Promise<ValidatedReceiptUpload> {
  const fileName = String(input.fileName ?? '').trim();
  const declaredMimeType = String(input.declaredMimeType ?? '').trim().toLowerCase();
  const content = input.content instanceof Uint8Array
    ? new Uint8Array(input.content)
    : new Uint8Array();
  if (
    !fileName
    || fileName.length > 255
    || fileName.includes('/')
    || fileName.includes('\\')
  ) {
    return uploadError(
      'receipt_file_name_invalid',
      'Receipt file name must be a plain name of at most 255 characters.',
    );
  }
  if (content.byteLength <= 0) {
    return uploadError('receipt_empty', 'Receipt content is empty.');
  }
  if (content.byteLength > RECEIPT_UPLOAD_MAX_BYTES) {
    return uploadError(
      'receipt_too_large',
      'Receipt content exceeds the 20 MB upload limit.',
      413,
    );
  }
  const detected = detectFormat(content);
  const rules = FORMAT_RULES[detected.format];
  if (
    !rules.extensions.has(extension(fileName))
    || !rules.mimeTypes.has(declaredMimeType)
  ) {
    return uploadError(
      'receipt_type_mismatch',
      'The file extension or declared MIME type does not match the detected content.',
    );
  }
  if (
    detected.format === 'heic'
    && declaredMimeType !== detected.mimeType
    && !(declaredMimeType === 'image/heic' && detected.mimeType === 'image/heif')
  ) {
    return uploadError(
      'receipt_type_mismatch',
      'The declared HEIC/HEIF MIME type does not match the detected content.',
    );
  }
  const pageCount = detected.format === 'pdf' ? await pdfPageCount(content) : 1;
  if (pageCount <= 0 || pageCount > RECEIPT_UPLOAD_MAX_PDF_PAGES) {
    return uploadError(
      'receipt_pdf_page_limit',
      'Receipt PDFs may contain at most 20 pages.',
      413,
    );
  }
  return {
    content,
    fileName,
    format: detected.format,
    mimeType: detected.mimeType,
    pageCount,
  };
}
