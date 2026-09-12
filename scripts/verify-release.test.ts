import { createServer } from 'node:http';
import type { Server, ServerResponse, IncomingMessage } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { verifyRelease } from './verify-release.mjs';

const expectedRevision = 'test-release-revision';
const assetBody = Buffer.from('asset-body');
const assetHash = createHash('sha256').update(assetBody).digest('hex');
const scriptPath = path.join(process.cwd(), 'scripts', 'verify-release.mjs');

type FixtureMode = 'ok' | 'mismatch' | 'redirect' | 'same-redirect' | 'asset-mismatch' | 'asset-hash-mismatch';

interface RunningFixture {
  baseUrl: string;
  server: Server;
  setMode: (mode: FixtureMode) => void;
}

function sendJson(response: ServerResponse, value: unknown, statusCode = 200): void {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(body);
}

function handleFixtureRequest(request: IncomingMessage, response: ServerResponse, mode: FixtureMode): void {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (requestUrl.pathname === '/erp') {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>ERP</title>');
    return;
  }
  if (requestUrl.pathname === '/erp/health' && ['redirect', 'same-redirect'].includes(mode)) {
    response.writeHead(302, {
      location: mode === 'redirect' ? '/erp/wrong-health' : '/erp/health/',
    });
    response.end();
    return;
  }
  if (requestUrl.pathname === '/erp/health' || requestUrl.pathname === '/erp/health/') {
    sendJson(response, {
      status: 'ok',
      service: 'erp-system-api',
      revision: mode === 'mismatch' ? 'unexpected-release-revision' : expectedRevision,
    });
    return;
  }
  if (requestUrl.pathname === '/erp/wrong-health') {
    sendJson(response, {
      status: 'ok',
      service: 'erp-system-api',
      revision: expectedRevision,
    });
    return;
  }
  if (requestUrl.pathname === '/erp/api/setup/status') {
    sendJson(response, { initialized: true, status: 'ready' });
    return;
  }
  if (requestUrl.pathname === '/erp/index.html') {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(mode === 'asset-mismatch' ? 'changed-body' : assetBody);
    return;
  }
  if (requestUrl.pathname === '/erp/release.json') {
    sendJson(response, {
      schemaVersion: 1,
      revision: expectedRevision,
      fileCount: 1,
      files: [{
        path: 'index.html',
        bytes: assetBody.byteLength,
        sha256: mode === 'asset-hash-mismatch' ? 'f'.repeat(64) : assetHash,
      }],
    });
    return;
  }
  response.writeHead(404, { 'content-type': 'text/plain' });
  response.end('not found');
}

async function startFixture(): Promise<RunningFixture> {
  let mode: FixtureMode = 'ok';
  const server = createServer((request, response) => handleFixtureRequest(request, response, mode));
  server.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server has no TCP address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}/erp`,
    server,
    setMode: (nextMode) => { mode = nextMode; },
  };
}

async function stopFixture(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

interface CliResult {
  code: number | null;
  stderr: string;
  stdout: string;
}

async function runVerifier(args: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stderr, stdout }));
  });
}

describe('verifyRelease', () => {
  let running: RunningFixture;

  beforeAll(async () => {
    running = await startFixture();
  });

  afterAll(async () => {
    await stopFixture(running.server);
  });

  it('verifies the root, API health, setup status and release manifest', async () => {
    running.setMode('ok');
    await expect(verifyRelease({ origin: running.baseUrl, expectedRevision })).resolves.toMatchObject({
      status: 'verified',
      origin: running.baseUrl,
      revision: expectedRevision,
      fileCount: 1,
      setupStatusKeys: ['initialized', 'status'],
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

  it('rejects a health and manifest revision mismatch', async () => {
    running.setMode('mismatch');
    await expect(verifyRelease({ origin: running.baseUrl, expectedRevision }))
      .rejects.toMatchObject({ code: 'revision_mismatch' });
  });

  it('rejects an asset whose bytes do not match the release manifest', async () => {
    running.setMode('asset-mismatch');
    await expect(verifyRelease({ origin: running.baseUrl, expectedRevision }))
      .rejects.toMatchObject({ code: 'asset_bytes_mismatch' });
  });

  it('rejects an asset whose hash does not match the release manifest', async () => {
    running.setMode('asset-hash-mismatch');
    await expect(verifyRelease({ origin: running.baseUrl, expectedRevision }))
      .rejects.toMatchObject({ code: 'asset_hash_mismatch' });
  });

  it('rejects a redirect that changes the reviewed endpoint path', async () => {
    running.setMode('redirect');
    await expect(verifyRelease({ origin: running.baseUrl, expectedRevision }))
      .rejects.toMatchObject({ code: 'final_url_mismatch' });
  });

  it('cancels an early-failing response body before rejecting its final URL', async () => {
    const cancel = vi.fn(async () => undefined);
    const responseWithBody = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('untrusted body'));
      },
      cancel,
    }), { status: 200, headers: { 'content-type': 'text/html' } });
    Object.defineProperty(responseWithBody, 'url', { value: 'http://127.0.0.1:1/unreviewed' });

    await expect(verifyRelease({
      origin: running.baseUrl,
      expectedRevision,
      fetchImpl: async () => responseWithBody,
    })).rejects.toMatchObject({ code: 'final_url_mismatch' });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('cancels an advertised oversized response before reading its body', async () => {
    const cancel = vi.fn(async () => undefined);
    const responseWithBody = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('oversized body'));
      },
      cancel,
    }), {
      status: 200,
      headers: {
        'content-length': String(2 * 1024 * 1024 + 1),
        'content-type': 'text/html',
      },
    });
    Object.defineProperty(responseWithBody, 'url', { value: running.baseUrl });

    await expect(verifyRelease({
      origin: running.baseUrl,
      expectedRevision,
      fetchImpl: async () => responseWithBody,
    })).rejects.toMatchObject({ code: 'evidence_too_large' });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('releases the reader when a response stream fails', async () => {
    const cancel = vi.fn(async () => undefined);
    const responseWithBody = new Response(new ReadableStream({
      start(controller) {
        controller.error(new Error('fixture stream failure'));
      },
      cancel,
    }), { status: 200, headers: { 'content-type': 'text/html' } });
    Object.defineProperty(responseWithBody, 'url', { value: running.baseUrl });

    await expect(verifyRelease({
      origin: running.baseUrl,
      expectedRevision,
      fetchImpl: async () => responseWithBody,
    })).rejects.toMatchObject({ code: 'evidence_read_error' });
    expect(cancel).toHaveBeenCalledTimes(0);
    expect(responseWithBody.body?.locked).toBe(false);
  });

  it('cancels a streamed reader when reading fails before returning a fixed error', async () => {
    const readError = new Error('fixture transport detail');
    const cancel = vi.fn(async () => undefined);
    const releaseLock = vi.fn();
    const responseWithBody = {
      url: running.baseUrl,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: {
        getReader: () => ({
          read: async () => { throw readError; },
          cancel,
          releaseLock,
        }),
      },
    } as unknown as Response;

    await expect(verifyRelease({
      origin: running.baseUrl,
      expectedRevision,
      fetchImpl: async () => responseWithBody,
    })).rejects.toMatchObject({
      code: 'evidence_read_error',
      message: 'Could not read root.',
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it('returns machine-readable success and failure status from the CLI', async () => {
    running.setMode('same-redirect');
    const success = await runVerifier([
      running.baseUrl,
      '--expected-revision',
      expectedRevision,
    ]);
    expect(success.code).toBe(0);
    expect(success.stderr).toBe('');
    expect(JSON.parse(success.stdout)).toMatchObject({ status: 'verified', revision: expectedRevision });

    running.setMode('mismatch');
    const failure = await runVerifier([
      running.baseUrl,
      '--expected-revision',
      expectedRevision,
    ]);
    expect(failure.code).toBe(1);
    expect(failure.stderr).toBe('');
    expect(JSON.parse(failure.stdout)).toMatchObject({
      status: 'failed',
      code: 'revision_mismatch',
    });
  });
});
