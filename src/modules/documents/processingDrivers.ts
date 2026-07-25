import type {
  DocumentExtractor,
  MalwareScanner,
} from './processing';

function boundedUrl(value: string, label: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must use HTTP or HTTPS.`);
  }
  return url;
}

async function responseJson(response: Response) {
  if (!response.ok) {
    throw new Error(`Document processing service returned HTTP ${response.status}.`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export function createHttpMalwareScanner(urlValue: string): MalwareScanner {
  const url = boundedUrl(urlValue, 'DOCUMENT_SCANNER_URL');
  return {
    async scan(input) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': input.mimeType,
          'x-content-sha256': input.sha256,
        },
        body: Buffer.from(input.content),
        signal: AbortSignal.timeout(60_000),
      });
      const body = await responseJson(response);
      if (!['clean', 'infected', 'indeterminate'].includes(String(body.status))) {
        throw new Error('Malware scanner returned an unsupported status.');
      }
      return {
        status: body.status as 'clean' | 'infected' | 'indeterminate',
        scanner: String(body.scanner || 'local-malware-scanner').slice(0, 160),
        resultCode: String(body.resultCode || body.status).slice(0, 160),
      };
    },
  };
}

export function createHttpLocalOcrExtractor(urlValue: string): DocumentExtractor {
  const url = boundedUrl(urlValue, 'DOCUMENT_LOCAL_OCR_URL');
  return {
    async extract(input) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': input.mimeType,
          'x-content-sha256': input.sha256,
        },
        body: Buffer.from(input.content),
        signal: AbortSignal.timeout(120_000),
      });
      const body = await responseJson(response);
      if (typeof body.rawText !== 'string' || !body.rawText.trim()) {
        throw new Error('Local OCR returned no extractable text.');
      }
      if (body.rawText.length > 5_000_000) {
        throw new Error('Local OCR output exceeds the 5,000,000-character limit.');
      }
      return {
        rawText: body.rawText,
        model: String(body.model || 'local-ocr').slice(0, 160),
      };
    },
  };
}

export function createHttpByokVisionExtractor(urlValue: string): DocumentExtractor {
  const url = boundedUrl(urlValue, 'DOCUMENT_VISION_GATEWAY_URL');
  return {
    async extract(input) {
      if (!input.credential || !input.region || input.retentionDays == null) {
        throw new Error('BYOK Vision requires credential, region and retention policy.');
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.credential}`,
          'content-type': input.mimeType,
          'x-content-sha256': input.sha256,
          'x-data-region': input.region,
          'x-retention-days': String(input.retentionDays),
        },
        body: Buffer.from(input.content),
        signal: AbortSignal.timeout(120_000),
      });
      const body = await responseJson(response);
      if (typeof body.rawText !== 'string' || !body.rawText.trim()) {
        throw new Error('BYOK Vision returned no extractable text.');
      }
      if (body.rawText.length > 5_000_000) {
        throw new Error('BYOK Vision output exceeds the 5,000,000-character limit.');
      }
      return {
        rawText: body.rawText,
        model: String(body.model || 'byok-vision').slice(0, 160),
      };
    },
  };
}
