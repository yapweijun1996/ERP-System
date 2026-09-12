import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildAvailabilityAlert,
  checkAvailability,
  deliverAvailabilityAlert,
} from './check-availability.mjs';

const revision = 'availability-test-revision';
const asset = Buffer.from('availability-asset');
const assetHash = createHash('sha256').update(asset).digest('hex');

function response(body: string | Uint8Array, status = 200, contentType = 'application/json'): Response {
  return new Response(body, { status, headers: { 'content-type': contentType } });
}

function fixtureFetch(healthRevision = revision) {
  const responseFor = (input: string | URL, body: string | Uint8Array, status = 200, contentType = 'application/json') => {
    const result = response(body, status, contentType);
    Object.defineProperty(result, 'url', { value: String(input) });
    return result;
  };
  return async (input: string | URL): Promise<Response> => {
    const pathname = new URL(input).pathname;
    if (pathname === '/erp') return responseFor(input, '<!doctype html><title>ERP</title>', 200, 'text/html');
    if (pathname === '/erp/health') {
      return responseFor(input, JSON.stringify({ status: 'ok', service: 'erp-system-api', revision: healthRevision }));
    }
    if (pathname === '/erp/api/setup/status') return responseFor(input, JSON.stringify({ initialized: true }));
    if (pathname === '/erp/release.json') {
      return responseFor(input, JSON.stringify({
        schemaVersion: 1,
        revision,
        fileCount: 1,
        files: [{ path: 'index.html', bytes: asset.byteLength, sha256: assetHash }],
      }));
    }
    if (pathname === '/erp/index.html') return responseFor(input, asset, 200, 'text/html');
    return responseFor(input, 'not found', 404, 'text/plain');
  };
}

describe('checkAvailability', () => {
  it('returns a healthy, sanitized event after full release verification', async () => {
    await expect(checkAvailability({
      origin: 'http://127.0.0.1:9000/erp',
      expectedRevision: revision,
      target: 'erp-test',
      fetchImpl: fixtureFetch(),
      now: () => new Date('2026-09-11T04:00:00.000Z'),
    })).resolves.toEqual({
      status: 'healthy',
      target: 'erp-test',
      checkedAt: '2026-09-11T04:00:00.000Z',
      revision,
      fileCount: 1,
      checks: {
        root: true,
        health: true,
        setupStatus: true,
        releaseManifest: true,
        assetHashes: true,
        revisionMatch: true,
        finalUrlsReviewed: true,
      },
    });
  });

  it('returns degraded with the verifier code when the release revision is wrong', async () => {
    await expect(checkAvailability({
      origin: 'http://127.0.0.1:9000/erp',
      expectedRevision: revision,
      fetchImpl: fixtureFetch('wrong-revision'),
    })).resolves.toMatchObject({ status: 'degraded', code: 'revision_mismatch' });
  });

  it('returns a bounded timeout classification without exposing transport details', async () => {
    const fetchImpl = async (_input: string | URL, options: { signal?: AbortSignal } = {}) => (
      new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(response('{}')), 50);
        options.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('transport detail must not escape'));
        }, { once: true });
      })
    );
    await expect(checkAvailability({
      origin: 'http://127.0.0.1:9000/erp',
      expectedRevision: revision,
      timeoutMs: 5,
      fetchImpl,
    })).resolves.toMatchObject({
      status: 'degraded',
      code: 'request_timeout',
      message: 'A bounded release verification request timed out.',
    });
  });

  it('sanitizes unexpected verifier errors before emitting the event', async () => {
    const secretDetail = 'https://internal.example.test/?detail=fixture-internal-error';
    const fetchImpl = async (): Promise<Response> => ({
      url: 'http://127.0.0.1:9000/erp',
      status: 200,
      headers: {
        get: () => {
          throw new Error(secretDetail);
        },
      },
    } as unknown as Response);

    const result = await checkAvailability({
      origin: 'http://127.0.0.1:9000/erp',
      expectedRevision: revision,
      fetchImpl,
    });
    expect(result).toMatchObject({
      status: 'degraded',
      code: 'availability_check_failed',
      message: 'Release availability verification failed.',
    });
    expect(JSON.stringify(result)).not.toContain(secretDetail);
  });

  it('does not echo unknown CLI arguments in invalid events', () => {
    const scriptPath = fileURLToPath(new URL('./check-availability.mjs', import.meta.url));
    let output = '';
    let exitCode: number | undefined;
    try {
      execFileSync(process.execPath, [scriptPath, '--unknown=fixture-internal-detail'], {
        encoding: 'utf8',
      });
    } catch (error) {
      const result = error as { status?: number; stdout?: string };
      exitCode = result.status;
      output = result.stdout ?? '';
    }
    expect(exitCode).toBe(2);
    expect(output).toContain('"code":"invalid_argument"');
    expect(output).not.toContain('fixture-internal-detail');
  });

  it('builds a fixed, bounded degraded event without verifier detail', () => {
    const result = buildAvailabilityAlert({
      status: 'degraded',
      target: 'erp-test',
      checkedAt: '2026-09-11T04:00:00.000Z',
      code: 'availability_check_failed',
      message: 'https://internal.example.test/?secret=must-not-escape',
    });
    expect(result).toEqual({
      schemaVersion: 1,
      type: 'erp.availability.degraded',
      severity: 'critical',
      target: 'erp-test',
      checkedAt: '2026-09-11T04:00:00.000Z',
      dedupeKey: expect.stringMatching(/^[0-9a-f]{64}$/),
      code: 'availability_check_failed',
      message: 'Release availability verification failed.',
    });
    expect(JSON.stringify(result)).not.toContain('internal.example.test');
  });

  it('keeps the alert dedupe key stable across retries but changes it for a new release identity', () => {
    const first = buildAvailabilityAlert({
      status: 'healthy', target: 'erp-test', checkedAt: '2026-09-11T04:00:00.000Z',
      revision, fileCount: 1,
      checks: { root: true, health: true, setupStatus: true, releaseManifest: true, assetHashes: true, revisionMatch: true, finalUrlsReviewed: true },
    });
    const retry = buildAvailabilityAlert({
      status: 'healthy', target: 'erp-test', checkedAt: '2026-09-11T04:05:00.000Z',
      revision, fileCount: 1,
      checks: { root: true, health: true, setupStatus: true, releaseManifest: true, assetHashes: true, revisionMatch: true, finalUrlsReviewed: true },
    });
    const changed = buildAvailabilityAlert({
      status: 'healthy', target: 'erp-test', checkedAt: '2026-09-11T04:05:00.000Z',
      revision: 'new-release-revision', fileCount: 1,
      checks: { root: true, health: true, setupStatus: true, releaseManifest: true, assetHashes: true, revisionMatch: true, finalUrlsReviewed: true },
    });
    expect(first.dedupeKey).toMatch(/^[0-9a-f]{64}$/);
    expect(retry.dedupeKey).toBe(first.dedupeKey);
    expect(changed.dedupeKey).not.toBe(first.dedupeKey);
  });

  it('keeps degraded retries stable but separates a changed verifier code', () => {
    const first = buildAvailabilityAlert({
      status: 'degraded', target: 'erp-test', checkedAt: '2026-09-11T04:00:00.000Z',
      code: 'revision_mismatch', message: 'ignored',
    });
    const retry = buildAvailabilityAlert({
      status: 'degraded', target: 'erp-test', checkedAt: '2026-09-11T04:05:00.000Z',
      code: 'revision_mismatch', message: 'ignored',
    });
    const changed = buildAvailabilityAlert({
      status: 'degraded', target: 'erp-test', checkedAt: '2026-09-11T04:05:00.000Z',
      code: 'health_mismatch', message: 'ignored',
    });
    expect(retry.dedupeKey).toBe(first.dedupeKey);
    expect(changed.dedupeKey).not.toBe(first.dedupeKey);
  });

  it('delivers only to an explicitly allowlisted HTTPS host and cleans the response body', async () => {
    let request;
    let cancelled = 0;
    const result = await deliverAvailabilityAlert({
      status: 'healthy', target: 'erp-test', checkedAt: '2026-09-11T04:00:00.000Z',
      revision, fileCount: 1,
      checks: { root: true, health: true, setupStatus: true, releaseManifest: true, assetHashes: true, revisionMatch: true, finalUrlsReviewed: true },
    }, {
      endpoint: 'https://alerts.example.test/events',
      allowedHosts: ['alerts.example.test'],
      authorization: 'Bearer fixture-token',
      fetchImpl: async (input, init) => {
        request = { input: String(input), init };
        return { ok: true, status: 202, redirected: false, body: { cancel: async () => { cancelled += 1; } } } as unknown as Response;
      },
    });
    expect(result).toEqual({ delivered: true, status: 202 });
    expect(request.input).toBe('https://alerts.example.test/events');
    expect(request.init.redirect).toBe('error');
    expect(request.init.headers.authorization).toBe('Bearer fixture-token');
    expect(request.init.headers['idempotency-key']).toBe(JSON.parse(String(request.init.body)).dedupeKey);
    expect(JSON.parse(String(request.init.body))).toMatchObject({ type: 'erp.availability.recovered', revision });
    expect(cancelled).toBe(1);
  });

  it.each([
    ['http://alerts.example.test/events', ['alerts.example.test'], 'alert_endpoint_invalid'],
    ['https://user:pass@alerts.example.test/events', ['alerts.example.test'], 'alert_endpoint_invalid'],
    ['https://alerts.example.test/events?token=secret', ['alerts.example.test'], 'alert_endpoint_invalid'],
    ['https://other.example.test/events', ['alerts.example.test'], 'alert_host_not_allowed'],
  ])('rejects unsafe alert endpoint %s', async (endpoint, allowedHosts, code) => {
    await expect(deliverAvailabilityAlert({
      status: 'degraded', target: 'erp-test', checkedAt: '2026-09-11T04:00:00.000Z', code: 'revision_mismatch', message: 'ignored',
    }, { endpoint, allowedHosts, fetchImpl: async () => { throw new Error('must not send'); } })).rejects.toMatchObject({ code });
  });

  it('returns a fixed error and cancels a rejected sink response without exposing its body', async () => {
    let cancelled = 0;
    await expect(deliverAvailabilityAlert({
      status: 'degraded', target: 'erp-test', checkedAt: '2026-09-11T04:00:00.000Z', code: 'revision_mismatch', message: 'ignored',
    }, {
      endpoint: 'https://alerts.example.test/events', allowedHosts: ['alerts.example.test'],
      fetchImpl: async () => ({ ok: false, status: 503, redirected: false, body: { cancel: async () => { cancelled += 1; } } } as unknown as Response),
    })).rejects.toMatchObject({ code: 'alert_delivery_rejected', message: 'Alert sink rejected the availability event.' });
    expect(cancelled).toBe(1);
  });

  it('classifies an alert sink timeout without leaking transport detail', async () => {
    await expect(deliverAvailabilityAlert({
      status: 'degraded', target: 'erp-test', checkedAt: '2026-09-11T04:00:00.000Z', code: 'request_timeout', message: 'ignored',
    }, {
      endpoint: 'https://alerts.example.test/events', allowedHosts: ['alerts.example.test'], timeoutMs: 5,
      fetchImpl: async (_input, options = {}) => new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('secret transport detail')), { once: true });
      }),
    })).rejects.toMatchObject({ code: 'alert_delivery_timeout', message: 'Alert delivery timed out within its configured bound.' });
  });
});
