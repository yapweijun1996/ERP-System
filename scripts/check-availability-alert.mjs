#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  AvailabilityAlertError,
  buildAvailabilityAlert,
  checkAvailability,
  deliverAvailabilityAlert,
  parseAvailabilityArgs,
} from './check-availability.mjs';

const ALERT_ENDPOINT_ENV = 'ERP_AVAILABILITY_ALERT_ENDPOINT';
const ALERT_HOSTS_ENV = 'ERP_AVAILABILITY_ALERT_ALLOWED_HOSTS';
const ALERT_AUTHORIZATION_ENV = 'ERP_AVAILABILITY_ALERT_AUTHORIZATION';
const ALERT_TIMEOUT_ENV = 'ERP_AVAILABILITY_ALERT_TIMEOUT_MS';

function alertConfiguration(environment) {
  const endpoint = typeof environment[ALERT_ENDPOINT_ENV] === 'string'
    ? environment[ALERT_ENDPOINT_ENV].trim()
    : '';
  if (!endpoint) return { configured: false };
  const allowedHosts = typeof environment[ALERT_HOSTS_ENV] === 'string'
    ? environment[ALERT_HOSTS_ENV].split(',').map((host) => host.trim()).filter(Boolean)
    : [];
  const authorization = typeof environment[ALERT_AUTHORIZATION_ENV] === 'string'
    ? environment[ALERT_AUTHORIZATION_ENV]
    : undefined;
  const timeoutValue = typeof environment[ALERT_TIMEOUT_ENV] === 'string'
    ? environment[ALERT_TIMEOUT_ENV].trim()
    : '';
  return {
    configured: true,
    endpoint,
    allowedHosts,
    ...(timeoutValue ? { timeoutMs: Number(timeoutValue) } : {}),
    ...(authorization ? { authorization } : {}),
  };
}

function safeAlertFailure(error) {
  if (error instanceof AvailabilityAlertError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'alert_delivery_failed', message: 'Alert delivery failed.' };
}

/**
 * Run the bounded release check and optionally deliver its sanitized event.
 * Alert delivery is disabled unless an endpoint and host allowlist are both
 * explicitly configured through the environment.
 */
export async function runAvailabilityAlert({
  args = [],
  environment = process.env,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  let options;
  try {
    options = parseAvailabilityArgs(args, environment);
  } catch {
    return {
      status: 'invalid',
      code: 'invalid_argument',
      message: 'Invalid availability options.',
      exitCode: 2,
    };
  }
  if (options.help) {
    return {
      status: 'help',
      message: 'Usage: node scripts/check-availability-alert.mjs <origin> --expected-revision <commit> [--timeout-ms <ms>] [--target <name>]',
      exitCode: 0,
    };
  }

  const result = await checkAvailability({ ...options, fetchImpl, now });
  let event;
  try {
    event = buildAvailabilityAlert(result);
  } catch (error) {
    const failure = safeAlertFailure(error);
    return {
      ...result,
      alert: { configured: false, delivered: false, ...failure },
      exitCode: 2,
    };
  }

  const configuration = alertConfiguration(environment);
  if (!configuration.configured) {
    return {
      ...result,
      event,
      alert: { configured: false, delivered: false },
      exitCode: result.status === 'degraded' ? 1 : 0,
    };
  }

  try {
    const delivery = await deliverAvailabilityAlert(result, {
      endpoint: configuration.endpoint,
      allowedHosts: configuration.allowedHosts,
      authorization: configuration.authorization,
      timeoutMs: configuration.timeoutMs,
      fetchImpl,
    });
    return {
      ...result,
      event,
      alert: { configured: true, delivered: true, status: delivery.status },
      exitCode: result.status === 'degraded' ? 1 : 0,
    };
  } catch (error) {
    const failure = safeAlertFailure(error);
    return {
      ...result,
      event,
      alert: { configured: true, delivered: false, ...failure },
      exitCode: result.status === 'degraded' ? 1 : 2,
    };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runAvailabilityAlert({ args: process.argv.slice(2) });
  const { exitCode, ...output } = result;
  console.log(JSON.stringify(output));
  process.exitCode = exitCode;
}
