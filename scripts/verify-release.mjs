#!/usr/bin/env node

import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;

export class ReleaseVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReleaseVerificationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ReleaseVerificationError(code, message);
}

function normalizedPath(pathname) {
  const value = pathname.replace(/\/+$/, '');
  return value || '/';
}

function parseOrigin(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    fail('invalid_origin', 'The release origin must be an absolute HTTP(S) URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    fail('invalid_origin', 'The release origin must use HTTP(S).');
  }
  if (url.username || url.password || url.search || url.hash) {
    fail('unsafe_origin', 'The release origin must not contain credentials, query parameters or fragments.');
  }
  return url;
}

function endpoint(baseUrl, suffix) {
  const basePath = normalizedPath(baseUrl.pathname);
  const url = new URL(baseUrl);
  url.pathname = `${basePath === '/' ? '' : basePath}/${suffix}`;
  return url;
}

async function fetchEvidence(target, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(target.url, {
      redirect: 'follow',
      headers: { accept: 'application/json, text/html' },
    });
  } catch {
    fail('network_error', `Could not fetch ${target.name}.`);
  }

  let finalUrl;
  try {
    finalUrl = new URL(response.url);
  } catch {
    fail('final_url_mismatch', `${target.name} did not expose a valid final URL.`);
  }
  if (finalUrl.origin !== target.url.origin
    || normalizedPath(finalUrl.pathname) !== normalizedPath(target.url.pathname)) {
    fail('final_url_mismatch', `${target.name} ended at an unreviewed origin or path.`);
  }

  const contentLength = response.headers.get('content-length');
  const declaredLength = contentLength === null ? null : Number(contentLength);
  if (declaredLength !== null && (!Number.isFinite(declaredLength) || declaredLength < 0)) {
    fail('invalid_content_length', `${target.name} returned an invalid content length.`);
  }
  if (declaredLength !== null && declaredLength > MAX_EVIDENCE_BYTES) {
    fail('evidence_too_large', `${target.name} exceeded the bounded evidence size.`);
  }
  let body;
  try {
    body = await response.text();
  } catch {
    fail('evidence_read_error', `Could not read ${target.name}.`);
  }
  if (Buffer.byteLength(body) > MAX_EVIDENCE_BYTES) {
    fail('evidence_too_large', `${target.name} exceeded the bounded evidence size.`);
  }
  return { response, body };
}

function parseObject(body, name) {
  let value;
  try {
    value = JSON.parse(body);
  } catch {
    fail(`${name}_invalid_json`, `${name} did not return a JSON object.`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${name}_invalid_json`, `${name} did not return a JSON object.`);
  }
  return value;
}

function assertSuccessfulResponse(response, name) {
  if (response.status !== 200) {
    fail(`${name}_http_${response.status}`, `${name} returned HTTP ${response.status}.`);
  }
}

function validateManifest(manifest) {
  if (manifest.schemaVersion !== 1) {
    fail('manifest_schema_invalid', 'The release manifest schema version is unsupported.');
  }
  if (typeof manifest.revision !== 'string' || !manifest.revision.trim()) {
    fail('manifest_revision_missing', 'The release manifest has no revision.');
  }
  if (!Number.isInteger(manifest.fileCount) || manifest.fileCount < 1 || !Array.isArray(manifest.files)) {
    fail('manifest_files_invalid', 'The release manifest file inventory is invalid or empty.');
  }
  if (manifest.fileCount !== manifest.files.length) {
    fail('manifest_files_mismatch', 'The release manifest file count does not match its inventory.');
  }

  const identities = new Set();
  for (const file of manifest.files) {
    if (!file || typeof file !== 'object'
      || typeof file.path !== 'string'
      || !file.path
      || file.path.startsWith('/')
      || file.path.includes('\\')
      || file.path.split('/').includes('..')
      || identities.has(file.path)
      || !Number.isInteger(file.bytes)
      || file.bytes < 0
      || typeof file.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/i.test(file.sha256)) {
      fail('manifest_file_invalid', 'The release manifest contains an invalid or duplicate file identity.');
    }
    identities.add(file.path);
  }
}

export async function verifyRelease({ origin, expectedRevision, fetchImpl = globalThis.fetch } = {}) {
  const baseUrl = parseOrigin(origin);
  if (typeof expectedRevision !== 'string' || !expectedRevision.trim()) {
    fail('expected_revision_required', 'An expected release revision is required.');
  }
  if (typeof fetchImpl !== 'function') {
    fail('fetch_unavailable', 'A fetch implementation is required.');
  }

  const targets = {
    root: { name: 'root', url: new URL(baseUrl) },
    health: { name: 'health', url: endpoint(baseUrl, 'health') },
    setupStatus: { name: 'setup status', url: endpoint(baseUrl, 'api/setup/status') },
    release: { name: 'release manifest', url: endpoint(baseUrl, 'release.json') },
  };
  const evidence = {};
  for (const [key, target] of Object.entries(targets)) {
    evidence[key] = await fetchEvidence(target, fetchImpl);
    assertSuccessfulResponse(evidence[key].response, key);
  }

  const health = parseObject(evidence.health.body, 'health');
  if (health.status !== 'ok' || health.service !== 'erp-system-api') {
    fail('health_unavailable', 'The API health response is not ready.');
  }
  if (typeof health.revision !== 'string' || !health.revision.trim()) {
    fail('health_revision_missing', 'The API health response has no revision.');
  }

  const setupStatus = parseObject(evidence.setupStatus.body, 'setup status');
  const manifest = parseObject(evidence.release.body, 'release manifest');
  validateManifest(manifest);
  if (health.revision !== manifest.revision) {
    fail('revision_mismatch', 'The API health and release manifest revisions differ.');
  }
  if (manifest.revision !== expectedRevision) {
    fail('revision_mismatch', 'The deployed revision does not match the expected revision.');
  }

  return {
    status: 'verified',
    origin: baseUrl.toString(),
    expectedRevision,
    revision: manifest.revision,
    fileCount: manifest.fileCount,
    setupStatusKeys: Object.keys(setupStatus).sort(),
    checks: {
      root: true,
      health: true,
      setupStatus: true,
      releaseManifest: true,
      revisionMatch: true,
      finalUrlsReviewed: true,
    },
  };
}

function parseCliArgs(args, environment = process.env) {
  let origin = environment.ERP_PUBLIC_URL;
  let expectedRevision = environment.EXPECTED_RELEASE_COMMIT;
  let originProvided = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument === '--expected-revision') {
      expectedRevision = args[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith('--expected-revision=')) {
      expectedRevision = argument.slice('--expected-revision='.length);
      continue;
    }
    if (argument.startsWith('-')) {
      fail('invalid_argument', `Unknown verifier option: ${argument}`);
    }
    if (originProvided) {
      fail('invalid_argument', 'Only one release origin may be provided.');
    }
    origin = argument;
    originProvided = true;
  }
  return { origin, expectedRevision };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node scripts/verify-release.mjs <origin> --expected-revision <commit>');
    } else {
      console.log(JSON.stringify(await verifyRelease(options)));
    }
  } catch (error) {
    const code = error instanceof ReleaseVerificationError ? error.code : 'verification_error';
    const message = error instanceof Error ? error.message : 'Release verification failed.';
    console.log(JSON.stringify({ status: 'failed', code, message }));
    process.exitCode = 1;
  }
}
