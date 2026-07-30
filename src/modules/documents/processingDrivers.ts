import type {
  DocumentExtractor,
  ExtractionFieldCandidate,
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

function extractionResult(
  body: Record<string, unknown>,
  fallbackModel: string,
  service: string,
) {
  if (typeof body.rawText !== 'string' || !body.rawText.trim()) {
    throw new Error(`${service} returned no extractable text.`);
  }
  if (body.rawText.length > 5_000_000) {
    throw new Error(`${service} output exceeds the 5,000,000-character limit.`);
  }
  if (body.fields != null && !Array.isArray(body.fields)) {
    throw new Error(`${service} returned invalid structured fields.`);
  }
  const fields: ExtractionFieldCandidate[] = (body.fields ?? []).map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${service} field ${index + 1} is invalid.`);
    }
    const field = value as Record<string, unknown>;
    if (
      typeof field.fieldKey !== 'string'
      || typeof field.value !== 'string'
      || typeof field.sourceRef !== 'string'
      || typeof field.confidence !== 'number'
      || (field.normalizedValue != null && typeof field.normalizedValue !== 'string')
      || (field.model != null && typeof field.model !== 'string')
    ) {
      throw new Error(`${service} field ${index + 1} is invalid.`);
    }
    return {
      fieldKey: field.fieldKey,
      value: field.value,
      normalizedValue: typeof field.normalizedValue === 'string'
        ? field.normalizedValue
        : undefined,
      sourceRef: field.sourceRef,
      confidence: field.confidence,
      model: typeof field.model === 'string' ? field.model : undefined,
    };
  });
  return {
    rawText: body.rawText,
    model: String(body.model || fallbackModel).slice(0, 160),
    safetyClear: body.safetyClear === true,
    fields,
  };
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
      return extractionResult(body, 'local-ocr', 'Local OCR');
    },
  };
}

export function createHttpByokVisionExtractor(urlValue: string): DocumentExtractor {
  const url = boundedUrl(urlValue, 'DOCUMENT_VISION_GATEWAY_URL');
  return {
    async extract(input) {
      if (!input.region || input.retentionDays == null) {
        throw new Error('BYOK Vision requires region and retention policy.');
      }
      const headers: Record<string, string> = {
        'content-type': input.mimeType,
        'x-content-sha256': input.sha256,
        'x-data-region': input.region,
        'x-retention-days': String(input.retentionDays),
      };
      if (input.credential) headers.authorization = `Bearer ${input.credential}`;
      if (input.provider) headers['x-vision-provider'] = input.provider;
      if (input.baseUrl) headers['x-provider-base-url'] = input.baseUrl;
      if (input.model) headers['x-provider-model'] = input.model;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: Buffer.from(input.content),
        signal: AbortSignal.timeout(120_000),
      });
      const body = await responseJson(response);
      return extractionResult(body, 'byok-vision', 'BYOK Vision');
    },
  };
}
