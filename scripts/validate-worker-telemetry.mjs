#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_RECORD_BYTES = 1 * 1024 * 1024;
const PRIMARY_QUEUES = [
  'outbox',
  'report',
  'tax-evidence',
  'document-scan',
  'document-extraction',
  'calendar-leave',
  'calendar-appointment',
  'calendar-reminder',
];
const CALENDAR_QUEUES = [
  'calendar-leave',
  'calendar-appointment',
  'calendar-reminder',
];
const QUEUE_FIELDS = [
  'pending',
  'ready',
  'inFlight',
  'retrying',
  'failed',
  'deadLettered',
];
const FORBIDDEN_KEY = /(?:master|company|tenant|payload|credential|secret|token|password|rawtext|content|lockedby|error)/i;

function validationError(message) {
  const error = new Error(message);
  error.name = 'WorkerTelemetryValidationError';
  return error;
}

function assert(condition, message) {
  if (!condition) throw validationError(message);
}

function positiveInteger(value, label) {
  assert(Number.isSafeInteger(value) && value > 0, `${label} must be a positive integer.`);
  return value;
}

function nonNegativeInteger(value, label) {
  assert(Number.isSafeInteger(value) && value >= 0, `${label} must be a non-negative integer.`);
}

function walkKeys(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!FORBIDDEN_KEY.test(key), `forbidden telemetry field at ${path}.${key}.`);
    walkKeys(child, `${path}.${key}`);
  }
}

function validateQueue(queue, index, expectedNames) {
  assert(queue && typeof queue === 'object' && !Array.isArray(queue), `queues[${index}] must be an object.`);
  assert(typeof queue.queue === 'string' && expectedNames.includes(queue.queue), `queues[${index}].queue is unsupported.`);
  for (const field of QUEUE_FIELDS) nonNegativeInteger(queue[field], `queues[${index}].${field}`);
  if (queue.oldestPendingAgeSeconds !== null) {
    nonNegativeInteger(queue.oldestPendingAgeSeconds, `queues[${index}].oldestPendingAgeSeconds`);
  }
  const allowed = new Set(['queue', ...QUEUE_FIELDS, 'oldestPendingAgeSeconds']);
  for (const key of Object.keys(queue)) assert(allowed.has(key), `queues[${index}] has unsupported field ${key}.`);
}

export function validateTelemetrySnapshot(value, options = {}) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'telemetry record must be an object.');
  assert(value.type === 'erp.worker.telemetry', 'telemetry record type must be erp.worker.telemetry.');
  assert(typeof value.workerId === 'string' && value.workerId.length > 0 && value.workerId.length <= 160,
    'workerId must be a bounded non-empty string.');
  assert(value.scope === 'primary' || value.scope === 'calendar', 'telemetry scope is unsupported.');
  assert(typeof value.generatedAt === 'string' && !Number.isNaN(Date.parse(value.generatedAt)),
    'generatedAt must be an ISO date string.');
  nonNegativeInteger(value.queryDurationMs, 'queryDurationMs');
  assert(Array.isArray(value.queues), 'queues must be an array.');
  const expectedNames = value.scope === 'primary' ? PRIMARY_QUEUES : CALENDAR_QUEUES;
  assert(value.queues.length === expectedNames.length, `queues must contain ${expectedNames.length} entries for ${value.scope}.`);
  const names = value.queues.map((queue, index) => {
    validateQueue(queue, index, expectedNames);
    return queue.queue;
  });
  assert(new Set(names).size === names.length, 'telemetry queue names must be unique.');
  assert(names.every((name, index) => name === expectedNames[index]), 'telemetry queues are out of order.');
  walkKeys(value);
  const allowed = new Set(['type', 'workerId', 'generatedAt', 'scope', 'queryDurationMs', 'queues']);
  for (const key of Object.keys(value)) assert(allowed.has(key), `telemetry record has unsupported field ${key}.`);
  const maxQueryMs = options.maxQueryMs;
  if (maxQueryMs !== undefined) positiveInteger(maxQueryMs, 'maxQueryMs');
  return {
    scope: value.scope,
    queueCount: value.queues.length,
    queryDurationMs: value.queryDurationMs,
    budgetExceeded: maxQueryMs !== undefined && value.queryDurationMs > maxQueryMs,
  };
}

export function validateTelemetryLines(input, options = {}) {
  assert(typeof input === 'string', 'telemetry input must be text.');
  assert(Buffer.byteLength(input, 'utf8') <= MAX_INPUT_BYTES, 'telemetry input exceeds the bounded size.');
  const summaries = [];
  for (const [index, line] of input.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    assert(Buffer.byteLength(line, 'utf8') <= MAX_RECORD_BYTES, `telemetry record ${index + 1} exceeds the bounded size.`);
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      throw validationError(`telemetry record ${index + 1} is not valid JSON.`);
    }
    summaries.push(validateTelemetrySnapshot(value, options));
  }
  assert(summaries.length > 0, 'telemetry input contains no records.');
  return {
    records: summaries,
    maxQueryDurationMs: Math.max(...summaries.map(summary => summary.queryDurationMs)),
    budgetExceeded: summaries.some(summary => summary.budgetExceeded),
  };
}

function parseArgs(args) {
  let maxQueryMs;
  let file = '-';
  let fileProvided = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument === '--max-query-ms') {
      const value = args[++index];
      assert(value !== undefined, '--max-query-ms requires a value.');
      maxQueryMs = Number(value);
      positiveInteger(maxQueryMs, '--max-query-ms');
      continue;
    }
    if (argument === '-') {
      assert(!fileProvided, 'only one telemetry input file may be supplied.');
      file = '-';
      fileProvided = true;
      continue;
    }
    assert(!argument.startsWith('-'), `unknown option ${argument}.`);
    assert(!fileProvided, 'only one telemetry input file may be supplied.');
    file = argument;
    fileProvided = true;
  }
  return { file, maxQueryMs };
}

function usage() {
  return 'Usage: node scripts/validate-worker-telemetry.mjs [--max-query-ms N] [file|-]';
}

export function runCli(args, readInput = (file) => file === '-' ? readFileSync(0, 'utf8') : readFileSync(file, 'utf8')) {
  const parsed = parseArgs(args);
  if (parsed.help) {
    console.log(usage());
    return 0;
  }
  let input;
  try {
    input = readInput(parsed.file);
  } catch {
    console.error('Unable to read telemetry input.');
    return 2;
  }
  try {
    const result = validateTelemetryLines(input, { maxQueryMs: parsed.maxQueryMs });
    const budget = parsed.maxQueryMs === undefined
      ? 'unconfigured'
      : result.budgetExceeded ? 'exceeded' : 'within';
    console.log(JSON.stringify({
      status: result.budgetExceeded ? 'budget_exceeded' : 'valid',
      records: result.records.length,
      maxQueryDurationMs: result.maxQueryDurationMs,
      queryBudgetMs: parsed.maxQueryMs ?? null,
      budget,
    }));
    return result.budgetExceeded ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid telemetry input.');
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = runCli(process.argv.slice(2));
}
