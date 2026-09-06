import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createHttpByokVisionExtractor,
  createHttpLocalOcrExtractor,
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

  it('rejects malformed or empty provider output', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{not-json', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ rawText: '   ' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const extractor = createHttpByokVisionExtractor('https://vision.example.test/extract');

    await expect(extractor.extract(input)).rejects.toThrow();
    await expect(extractor.extract(input)).rejects.toThrow('returned no extractable text');
  });

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
