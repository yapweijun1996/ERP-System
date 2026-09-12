import type {
  DocumentExtractor,
  ExtractionFieldCandidate,
  MalwareScanner,
} from './processing';

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

async function cancelResponseBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // Preserve the bounded application-owned error when cleanup fails.
  }
}

function boundedUrl(value: string, label: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must use HTTP or HTTPS.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must not contain credentials, query parameters or fragments.`);
  }
  return url;
}

async function boundedResponseText(response: Response): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength != null) {
    const normalizedLength = contentLength.trim();
    const parsedLength = Number(normalizedLength);
    if (!/^\d+$/.test(normalizedLength) || !Number.isSafeInteger(parsedLength)) {
      await cancelResponseBody(response);
      throw new Error('Document processing service returned an invalid content length.');
    }
    if (Number.isFinite(parsedLength) && parsedLength > MAX_RESPONSE_BYTES) {
      await cancelResponseBody(response);
      throw new Error('Document processing service response exceeds the 8 MiB limit.');
    }
  }
  if (!response.body) {
    const text = await response.text();
    // Custom runtimes may expose text() without a readable body; enforce the
    // same byte cap before parsing instead of trusting that fallback.
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new Error('Document processing service response exceeds the 8 MiB limit.');
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let readerCancelled = false;
  const cancelReader = async () => {
    if (readerCancelled) return;
    readerCancelled = true;
    try {
      await reader.cancel();
    } catch {
      // Preserve the original bounded or transport error if stream cancellation fails.
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await cancelReader();
        throw new Error('Document processing service response exceeds the 8 MiB limit.');
      }
      chunks.push(value);
    }
  } catch (error) {
    await cancelReader();
    throw error;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function responseJson(response: Response) {
  if (!response.ok) {
    await cancelResponseBody(response);
    throw new Error(`Document processing service returned HTTP ${response.status}.`);
  }
  const text = await boundedResponseText(response);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Document processing service returned an invalid JSON response.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Document processing service returned an invalid JSON response.');
  }
  return parsed as Record<string, unknown>;
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
  let visualFingerprint: string | undefined;
  if (body.visualFingerprint != null) {
    if (typeof body.visualFingerprint !== 'string') {
      throw new Error(`${service} returned an invalid visual fingerprint.`);
    }
    visualFingerprint = body.visualFingerprint.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(visualFingerprint)) {
      throw new Error(`${service} returned an invalid visual fingerprint.`);
    }
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
    visualFingerprint,
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
        redirect: 'error',
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
        redirect: 'error',
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
        redirect: 'error',
        headers,
        body: Buffer.from(input.content),
        signal: AbortSignal.timeout(120_000),
      });
      const body = await responseJson(response);
      return extractionResult(body, 'byok-vision', 'BYOK Vision');
    },
  };
}
