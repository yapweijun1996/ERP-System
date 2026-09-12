import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createHttpByokVisionExtractor,
  createHttpLocalOcrExtractor,
  createHttpMalwareScanner,
} from './processingDrivers';

const input = {
  content: Uint8Array.from([0xff, 0xd8, 0xff]),
  mimeType: 'image/jpeg',
  sha256: 'a'.repeat(64),
  region: 'sg',
  retentionDays: 0,
  credential: 'test-credential',
  provider: 'openai',
  model: 'receipt-vision-test',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('governed document processing HTTP drivers', () => {
  it('accepts only HTTP(S) gateway URLs', () => {
    expect(() => createHttpByokVisionExtractor('file:///tmp/vision'))
      .toThrow('DOCUMENT_VISION_GATEWAY_URL must use HTTP or HTTPS.');
    expect(() => createHttpLocalOcrExtractor('not-a-url'))
      .toThrow();
  });

  it.each([
    ['credentials', 'https://fixture-user:fixture-pass@vision.example.test/extract'],
    ['query parameters', 'https://vision.example.test/extract?fixture=1'],
    ['fragments', 'https://vision.example.test/extract#fixture'],
  ])('rejects gateway URL %s before any document request', (_reason, value) => {
    expect(() => createHttpByokVisionExtractor(value))
      .toThrow('DOCUMENT_VISION_GATEWAY_URL must not contain credentials, query parameters or fragments.');
    expect(() => createHttpLocalOcrExtractor(value))
      .toThrow('DOCUMENT_LOCAL_OCR_URL must not contain credentials, query parameters or fragments.');
    expect(() => createHttpMalwareScanner(value))
      .toThrow('DOCUMENT_SCANNER_URL must not contain credentials, query parameters or fragments.');
  });

  it.each([
    ['malware scanner', () => createHttpMalwareScanner('https://scanner.example.test/scan').scan(input)],
    ['local OCR', () => createHttpLocalOcrExtractor('https://ocr.example.test/extract').extract(input)],
    ['BYOK Vision', () => createHttpByokVisionExtractor('https://vision.example.test/extract').extract(input)],
  ])('sets a fail-closed HTTP redirect policy for the %s driver', async (_label, request) => {
    const fetchMock = vi.fn(async (_input: URL, init?: RequestInit) => {
      expect(init?.redirect).toBe('error');
      return new Response(JSON.stringify({ rawText: 'redirected response' }), { status: 302 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(request()).rejects.toThrow('HTTP 302');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an oversized successful response before parsing provider output', async () => {
    const oversizedChunk = new Uint8Array((8 * 1024 * 1024) + 1);
    const fetchMock = vi.fn(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(oversizedChunk);
        controller.close();
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createHttpByokVisionExtractor('https://vision.example.test/extract')
      .extract(input)).rejects.toThrow('response exceeds the 8 MiB limit');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an advertised oversized response before reading the body', async () => {
    const cancel = vi.fn();
    const fetchMock = vi.fn(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"rawText":"ok"}'));
      },
      cancel,
    }), {
      status: 200,
      headers: {
        'content-length': String((8 * 1024 * 1024) + 1),
        'content-type': 'application/json',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createHttpLocalOcrExtractor('https://ocr.example.test/extract')
      .extract(input)).rejects.toThrow('response exceeds the 8 MiB limit');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('bounds a body-less response before parsing provider output', async () => {
    const oversizedText = 'x'.repeat((8 * 1024 * 1024) + 1);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      text: async () => oversizedText,
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createHttpByokVisionExtractor('https://vision.example.test/extract')
      .extract(input)).rejects.toThrow('response exceeds the 8 MiB limit');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cancels a streamed response reader when reading fails', async () => {
    const readError = new Error('stream read failed');
    const cancel = vi.fn(async () => undefined);
    const releaseLock = vi.fn();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: async () => { throw readError; },
          cancel,
          releaseLock,
        }),
      },
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createHttpByokVisionExtractor('https://vision.example.test/extract')
      .extract(input)).rejects.toThrow('stream read failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid advertised content length before reading the body', async () => {
    const cancel = vi.fn();
    const fetchMock = vi.fn(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"rawText":"ok"}'));
      },
      cancel,
    }), {
      status: 200,
      headers: {
        'content-length': 'not-a-decimal-length',
        'content-type': 'application/json',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createHttpLocalOcrExtractor('https://ocr.example.test/extract')
      .extract(input)).rejects.toThrow('invalid content length');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([401, 408, 429, 500, 503])(
    'fails closed on gateway HTTP %s without accepting the response as extraction',
    async (status) => {
      const fetchMock = vi.fn(async () => new Response(
        JSON.stringify({ rawText: 'unsafe upstream response' }),
        { status, headers: { 'content-type': 'application/json' } },
      ));
      vi.stubGlobal('fetch', fetchMock);

      await expect(createHttpByokVisionExtractor('https://vision.example.test/extract')
        .extract(input)).rejects.toThrow(`HTTP ${status}`);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('cancels failed response bodies before classifying provider failure', async () => {
    const cancel = vi.fn();
    const fetchMock = vi.fn(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"error":"upstream"}'));
      },
      cancel,
    }), { status: 500, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createHttpByokVisionExtractor('https://vision.example.test/extract')
      .extract(input)).rejects.toThrow('HTTP 500');
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed or non-object provider output with bounded errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{not-json', { status: 200 }))
      .mockResolvedValueOnce(new Response('null', { status: 200 }))
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ rawText: '   ' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const extractor = createHttpByokVisionExtractor('https://vision.example.test/extract');

    await expect(extractor.extract(input)).rejects.toThrow('invalid JSON response');
    await expect(extractor.extract(input)).rejects.toThrow('invalid JSON response');
    await expect(extractor.extract(input)).rejects.toThrow('invalid JSON response');
    await expect(extractor.extract(input)).rejects.toThrow('returned no extractable text');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('preserves a provider visual fingerprint without deriving one from OCR text', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      rawText: 'Merchant Example',
      model: 'gateway-model',
      visualFingerprint: `  ${'A'.repeat(64)}  `,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createHttpByokVisionExtractor('https://vision.example.test/extract')
      .extract(input)).resolves.toMatchObject({
        rawText: 'Merchant Example',
        visualFingerprint: 'a'.repeat(64),
      });
  });

  it('allows a response without a provider visual fingerprint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      rawText: 'Merchant Example',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createHttpByokVisionExtractor('https://vision.example.test/extract')
      .extract(input)).resolves.toMatchObject({ rawText: 'Merchant Example' });
  });

  it.each(['not-a-fingerprint', 'g'.repeat(64), 123])(
    'rejects an invalid provider visual fingerprint: %s',
    async (visualFingerprint) => {
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({
        rawText: 'Merchant Example',
        visualFingerprint,
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(createHttpByokVisionExtractor('https://vision.example.test/extract')
        .extract(input)).rejects.toThrow('invalid visual fingerprint');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('propagates transport timeout/failure for the worker retry boundary', async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException('The operation was aborted', 'TimeoutError');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createHttpLocalOcrExtractor('https://ocr.example.test/extract')
      .extract(input)).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('sends policy headers while keeping the credential inside the server call', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      rawText: 'Merchant Example',
      model: 'gateway-model',
      safetyClear: true,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createHttpByokVisionExtractor('https://vision.example.test/extract')
      .extract(input);

    expect(result).toMatchObject({ rawText: 'Merchant Example', model: 'gateway-model', safetyClear: true });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://vision.example.test/extract'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer test-credential',
          'x-data-region': 'sg',
          'x-retention-days': '0',
          'x-vision-provider': 'openai',
          'x-provider-model': 'receipt-vision-test',
        }),
      }),
    );
  });
});
