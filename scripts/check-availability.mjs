#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ReleaseVerificationError, verifyRelease } from './verify-release.mjs';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 120_000;
const DEFAULT_TARGET = 'erp-release';
const MAX_ALERT_BYTES = 16 * 1024;

const ALERT_MESSAGES = Object.freeze({
  request_timeout: 'Release verification timed out within its configured bound.',
  root_http_502: 'The release root probe returned an unexpected HTTP response.',
  revision_mismatch: 'The running release does not match the expected revision.',
  health_mismatch: 'The running health revision does not match the release manifest.',
  setup_status_invalid: 'The release setup-status probe returned an invalid response.',
  release_manifest_invalid: 'The release manifest could not be verified.',
  asset_hash_mismatch: 'A released asset did not match its declared identity.',
  final_url_mismatch: 'A release endpoint returned an unexpected final URL.',
  availability_check_failed: 'Release availability verification failed.',
});

const ALERT_CHECK_KEYS = Object.freeze([
  'root', 'health', 'setupStatus', 'releaseManifest', 'assetHashes', 'revisionMatch', 'finalUrlsReviewed',
]);

export class AvailabilityAlertError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AvailabilityAlertError';
    this.code = code;
  }
}

class AvailabilityArgumentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AvailabilityArgumentError';
  }
}

function positiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (!/^\d+$/.test(String(value))) {
    throw new AvailabilityArgumentError(`${name} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new AvailabilityArgumentError(`${name} must be between 1 and ${maximum}.`);
  }
  return parsed;
}

function boundedTarget(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value)) {
    throw new AvailabilityArgumentError(
      'target must contain only bounded ASCII letters, numbers, dots, underscores, colons or hyphens.',
    );
  }
  return value;
}

export function parseAvailabilityArgs(args, environment = process.env) {
  let origin = environment.ERP_PUBLIC_URL;
  let expectedRevision = environment.EXPECTED_RELEASE_COMMIT;
  let timeoutMs = environment.ERP_AVAILABILITY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
  let target = environment.ERP_AVAILABILITY_TARGET ?? DEFAULT_TARGET;
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
    if (argument === '--timeout-ms') {
      timeoutMs = args[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith('--timeout-ms=')) {
      timeoutMs = argument.slice('--timeout-ms='.length);
      continue;
    }
    if (argument === '--target') {
      target = args[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith('--target=')) {
      target = argument.slice('--target='.length);
      continue;
    }
    if (argument.startsWith('-')) {
      throw new AvailabilityArgumentError('Unknown availability option.');
    }
    if (originProvided) {
      throw new AvailabilityArgumentError('Only one release origin may be provided.');
    }
    origin = argument;
    originProvided = true;
  }

  return {
    origin,
    expectedRevision,
    timeoutMs: positiveInteger(timeoutMs, 'timeout-ms', MAX_TIMEOUT_MS),
    target: boundedTarget(target),
  };
}

function timedFetch(fetchImpl, timeoutMs, state) {
  return (url, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      state.timedOut = true;
      controller.abort();
    }, timeoutMs);
    const parentSignal = options.signal;
    const abortFromParent = () => controller.abort();
    if (parentSignal) {
      if (parentSignal.aborted) controller.abort();
      else parentSignal.addEventListener('abort', abortFromParent, { once: true });
    }

    return Promise.resolve(fetchImpl(url, { ...options, signal: controller.signal }))
      .finally(() => {
        clearTimeout(timer);
        parentSignal?.removeEventListener('abort', abortFromParent);
      });
  };
}

export async function checkAvailability({
  origin,
  expectedRevision,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  target = DEFAULT_TARGET,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  const state = { timedOut: false };
  const checkedAt = now().toISOString();
  try {
    const result = await verifyRelease({
      origin,
      expectedRevision,
      fetchImpl: timedFetch(fetchImpl, timeoutMs, state),
    });
    return {
      status: 'healthy',
      target,
      checkedAt,
      revision: result.revision,
      fileCount: result.fileCount,
      checks: result.checks,
    };
  } catch (error) {
    const code = state.timedOut
      ? 'request_timeout'
      : error instanceof ReleaseVerificationError ? error.code : 'availability_check_failed';
    return {
      status: 'degraded',
      target,
      checkedAt,
      code,
      message: state.timedOut
        ? 'A bounded release verification request timed out.'
        : error instanceof ReleaseVerificationError
          ? error.message
          : 'Release availability verification failed.',
    };
  }
}

function boundedAlertCode(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ALERT_MESSAGES, value)
    ? value
    : 'availability_check_failed';
}

function boundedAlertText(value, fallback, maximum = 128) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum || hasControlCharacter(value)) {
    return fallback;
  }
  return value;
}

function hasControlCharacter(value) {
  return Array.from(value, (character) => character.charCodeAt(0)).some((code) => code < 32 || code === 127);
}

function boundedChecks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result = {};
  for (const key of ALERT_CHECK_KEYS) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  return Object.keys(result).length === ALERT_CHECK_KEYS.length ? result : undefined;
}

function availabilityDedupeKey(event) {
  const identity = event.type === 'erp.availability.recovered'
    ? {
      type: event.type,
      target: event.target,
      revision: event.revision,
      fileCount: event.fileCount,
      checks: event.checks,
    }
    : {
      type: event.type,
      target: event.target,
      code: event.code,
    };
  return createHash('sha256')
    .update(`erp.availability.v1:${JSON.stringify(identity)}`)
    .digest('hex');
}

/**
 * Build a stable, secret-free event for an approved alert sink. The verifier's
 * free-form transport message is intentionally discarded; only a bounded code
 * and fixed operator-facing message cross the alert boundary.
 */
export function buildAvailabilityAlert(result) {
  if (!result || (result.status !== 'healthy' && result.status !== 'degraded')) {
    throw new AvailabilityAlertError('alert_event_invalid', 'Availability result is invalid.');
  }
  let target;
  try {
    target = boundedTarget(result.target);
  } catch {
    throw new AvailabilityAlertError('alert_event_invalid', 'Availability target is invalid.');
  }
  const checkedAt = boundedAlertText(result.checkedAt, '', 64);
  if (!checkedAt || Number.isNaN(Date.parse(checkedAt))) {
    throw new AvailabilityAlertError('alert_event_invalid', 'Availability event time is invalid.');
  }
  const event = {
    schemaVersion: 1,
    type: result.status === 'healthy' ? 'erp.availability.recovered' : 'erp.availability.degraded',
    severity: result.status === 'healthy' ? 'info' : 'critical',
    target,
    checkedAt,
  };
  if (result.status === 'healthy') {
    const revision = boundedAlertText(result.revision, 'unknown', 128);
    const fileCount = Number(result.fileCount);
    const checks = boundedChecks(result.checks);
    if (revision === 'unknown' || !Number.isSafeInteger(fileCount) || fileCount < 0 || fileCount > 100_000 || !checks) {
      throw new AvailabilityAlertError('alert_event_invalid', 'Healthy availability evidence is incomplete.');
    }
    event.revision = revision;
    event.fileCount = fileCount;
    event.checks = checks;
  } else {
    const code = boundedAlertCode(result.code);
    event.code = code;
    event.message = ALERT_MESSAGES[code];
  }
  event.dedupeKey = availabilityDedupeKey(event);
  if (Buffer.byteLength(JSON.stringify(event), 'utf8') > MAX_ALERT_BYTES) {
    throw new AvailabilityAlertError('alert_event_too_large', 'Availability event exceeds its size limit.');
  }
  return Object.freeze(event);
}

function alertEndpoint(endpoint, allowedHosts) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) {
    throw new AvailabilityAlertError('alert_endpoint_invalid', 'Alert endpoint is invalid.');
  }
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new AvailabilityAlertError('alert_endpoint_invalid', 'Alert endpoint is invalid.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.port) {
    throw new AvailabilityAlertError('alert_endpoint_invalid', 'Alert endpoint must be a credential-free HTTPS URL.');
  }
  if (!Array.isArray(allowedHosts) || allowedHosts.length === 0 || !allowedHosts.every((host) => typeof host === 'string')) {
    throw new AvailabilityAlertError('alert_host_allowlist_required', 'Alert endpoint host allowlist is required.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!allowedHosts.some((host) => host.toLowerCase() === hostname)) {
    throw new AvailabilityAlertError('alert_host_not_allowed', 'Alert endpoint host is not allowlisted.');
  }
  return parsed.toString();
}

/**
 * Deliver one availability result as a sanitized event. No request is attempted
 * unless the caller supplies an explicit HTTPS host allowlist.
 */
export async function deliverAvailabilityAlert(result, {
  endpoint,
  allowedHosts,
  authorization,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
  signal,
} = {}) {
  const safeEvent = buildAvailabilityAlert(result);
  const target = alertEndpoint(endpoint, allowedHosts);
  let timeout;
  try {
    timeout = positiveInteger(timeoutMs, 'timeout-ms', MAX_TIMEOUT_MS);
  } catch {
    throw new AvailabilityAlertError('alert_timeout_invalid', 'Alert timeout is invalid.');
  }
  if (authorization !== undefined && (typeof authorization !== 'string' || authorization.length > 4096 || hasControlCharacter(authorization))) {
    throw new AvailabilityAlertError('alert_authorization_invalid', 'Alert authorization is invalid.');
  }
  const state = { timedOut: false };
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (authorization) headers.authorization = authorization;
  headers['idempotency-key'] = safeEvent.dedupeKey;
  let response;
  try {
    response = await timedFetch(fetchImpl, timeout, state)(target, {
      method: 'POST',
      headers,
      body: JSON.stringify(safeEvent),
      redirect: 'error',
      signal,
    });
    if (response.redirected || !response.ok) {
      throw new AvailabilityAlertError('alert_delivery_rejected', 'Alert sink rejected the availability event.');
    }
    return { delivered: true, status: response.status };
  } catch (error) {
    if (error instanceof AvailabilityAlertError) throw error;
    if (state.timedOut) throw new AvailabilityAlertError('alert_delivery_timeout', 'Alert delivery timed out within its configured bound.');
    if (signal?.aborted) throw new AvailabilityAlertError('alert_delivery_cancelled', 'Alert delivery was cancelled.');
    throw new AvailabilityAlertError('alert_delivery_failed', 'Alert delivery failed.');
  } finally {
    const cancel = response?.body?.cancel;
    if (typeof cancel === 'function') {
      try { await cancel.call(response.body); } catch { /* response cleanup is best effort */ }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseAvailabilityArgs(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node scripts/check-availability.mjs <origin> --expected-revision <commit> [--timeout-ms <ms>] [--target <name>]');
    } else {
      const result = await checkAvailability(options);
      console.log(JSON.stringify(result));
      if (result.status !== 'healthy') process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof AvailabilityArgumentError
      ? error.message
      : 'Invalid availability options.';
    console.log(JSON.stringify({ status: 'invalid', code: 'invalid_argument', message }));
    process.exitCode = 2;
  }
}
