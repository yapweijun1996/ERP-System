import { describe, expect, it } from 'vitest';
import { runAvailabilityAlert } from './check-availability-alert.mjs';

const revision = 'availability-alert-revision';

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });
}

function releaseFetch(healthRevision = revision) {
  return async (input: string | URL): Promise<Response> => {
    const pathname = new URL(input).pathname;
    const responseFor = (body: BodyInit, status = 200, contentType?: string) => {
      const response = new Response(body, {
        status,
        ...(contentType ? { headers: { 'content-type': contentType } } : {}),
      });
      Object.defineProperty(response, 'url', { value: String(input) });
      return response;
    };
    if (pathname === '/erp') return responseFor('<!doctype html><title>ERP</title>', 200, 'text/html');
    if (pathname === '/erp/health') {
      return responseFor(JSON.stringify({ status: 'ok', service: 'erp-system-api', revision: healthRevision }), 200, 'application/json');
    }
    if (pathname === '/erp/api/setup/status') return responseFor(JSON.stringify({ initialized: true }), 200, 'application/json');
    if (pathname === '/erp/release.json') {
      return responseFor(JSON.stringify({
        schemaVersion: 1,
        revision,
        fileCount: 1,
        files: [{ path: 'index.html', bytes: 5, sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' }],
      }), 200, 'application/json');
    }
    if (pathname === '/erp/index.html') return responseFor('hello', 200, 'text/html');
    return responseFor('not found', 404, 'text/plain');
  };
}

const args = ['http://127.0.0.1:9000/erp', '--expected-revision', revision];
const now = () => new Date('2026-09-11T14:00:00.000Z');

describe('availability alert command', () => {
  it('performs a sanitized dry-run without an alert sink', async () => {
    const result = await runAvailabilityAlert({ args, environment: {}, fetchImpl: releaseFetch(), now });
    expect(result).toMatchObject({
      status: 'healthy',
      alert: { configured: false, delivered: false },
      event: { type: 'erp.availability.recovered', revision },
      exitCode: 0,
    });
  });

  it('keeps degraded verifier state and exit status without a sink', async () => {
    const result = await runAvailabilityAlert({
      args,
      environment: {},
      fetchImpl: releaseFetch('wrong-revision'),
      now,
    });
    expect(result).toMatchObject({
      status: 'degraded',
      code: 'revision_mismatch',
      alert: { configured: false, delivered: false },
      event: { type: 'erp.availability.degraded', code: 'revision_mismatch' },
      exitCode: 1,
    });
  });

  it('delivers only with an explicit endpoint and matching host allowlist', async () => {
    let request: { init?: RequestInit } | undefined;
    const result = await runAvailabilityAlert({
      args,
      environment: {
        ERP_AVAILABILITY_ALERT_ENDPOINT: 'https://alerts.example.test/events',
        ERP_AVAILABILITY_ALERT_ALLOWED_HOSTS: 'alerts.example.test',
        ERP_AVAILABILITY_ALERT_AUTHORIZATION: 'Bearer fixture-alert-secret',
      },
      fetchImpl: async (input, init) => {
        if (new URL(input).hostname === 'alerts.example.test') {
          request = { init };
          return jsonResponse({}, 202);
        }
        return releaseFetch()(input);
      },
      now,
    });
    expect(result).toMatchObject({ status: 'healthy', alert: { configured: true, delivered: true, status: 202 }, exitCode: 0 });
    expect(new Headers(request?.init?.headers).get('idempotency-key')).toMatch(/^[0-9a-f]{64}$/);
    expect(new Headers(request?.init?.headers).get('authorization')).toBe('Bearer fixture-alert-secret');
    expect(JSON.stringify(result)).not.toContain('fixture-alert-secret');
  });

  it('fails closed when an endpoint lacks its allowlist and never sends', async () => {
    let calls = 0;
    const result = await runAvailabilityAlert({
      args,
      environment: {
        ERP_AVAILABILITY_ALERT_ENDPOINT: 'https://alerts.example.test/events',
        ERP_AVAILABILITY_ALERT_AUTHORIZATION: 'Bearer fixture-alert-secret',
      },
      fetchImpl: async (input) => {
        if (new URL(input).hostname === 'alerts.example.test') calls += 1;
        return releaseFetch()(input);
      },
      now,
    });
    expect(result).toMatchObject({
      status: 'healthy',
      alert: { configured: true, delivered: false, code: 'alert_host_allowlist_required' },
      exitCode: 2,
    });
    expect(calls).toBe(0);
    expect(JSON.stringify(result)).not.toContain('fixture-alert-secret');
  });

  it('returns a fixed sink rejection without exposing response details', async () => {
    const result = await runAvailabilityAlert({
      args,
      environment: {
        ERP_AVAILABILITY_ALERT_ENDPOINT: 'https://alerts.example.test/events',
        ERP_AVAILABILITY_ALERT_ALLOWED_HOSTS: 'alerts.example.test',
      },
      fetchImpl: async (input, init) => {
        if (new URL(input).hostname === 'alerts.example.test') return jsonResponse({ secret: 'sink-detail' }, 503);
        return releaseFetch()(input, init);
      },
      now,
    });
    expect(result).toMatchObject({
      status: 'healthy',
      alert: { configured: true, delivered: false, code: 'alert_delivery_rejected', message: 'Alert sink rejected the availability event.' },
      exitCode: 2,
    });
    expect(JSON.stringify(result)).not.toContain('sink-detail');
  });

  it('classifies a sink timeout without leaking transport errors', async () => {
    const result = await runAvailabilityAlert({
      args,
      environment: {
        ERP_AVAILABILITY_ALERT_ENDPOINT: 'https://alerts.example.test/events',
        ERP_AVAILABILITY_ALERT_ALLOWED_HOSTS: 'alerts.example.test',
        ERP_AVAILABILITY_ALERT_TIMEOUT_MS: '5',
      },
      fetchImpl: async (input, init = {}) => {
        if (new URL(input).hostname !== 'alerts.example.test') return releaseFetch()(input);
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('secret transport detail')), { once: true });
        });
      },
      now,
    });
    expect(result).toMatchObject({
      status: 'healthy',
      alert: { configured: true, delivered: false, code: 'alert_delivery_timeout' },
      exitCode: 2,
    });
    expect(JSON.stringify(result)).not.toContain('secret transport detail');
  });

  it('redacts invalid CLI details', async () => {
    const result = await runAvailabilityAlert({ args: ['--unknown=fixture-secret'], environment: {} });
    expect(result).toEqual({ status: 'invalid', code: 'invalid_argument', message: 'Invalid availability options.', exitCode: 2 });
    expect(JSON.stringify(result)).not.toContain('fixture-secret');
  });
});
