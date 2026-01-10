#!/usr/bin/env node
const args = new Set(process.argv.slice(2));

const tzIndex = process.argv.indexOf("--tz");
const localeIndex = process.argv.indexOf("--locale");

const timeZone =
  tzIndex >= 0 && process.argv[tzIndex + 1] ? process.argv[tzIndex + 1] : undefined;
const locale =
  localeIndex >= 0 && process.argv[localeIndex + 1] ? process.argv[localeIndex + 1] : "zh-CN";

const now = new Date();

function formatLocal() {
  return now.toLocaleString(locale, timeZone ? { timeZone } : undefined);
}

function formatIntl() {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(now);
}

const out = {
  iso: now.toISOString(),
  epochMs: Date.now(),
  epochS: Math.floor(Date.now() / 1000),
  local: formatLocal(),
  intl: formatIntl(),
  timeZone: timeZone ?? null,
  locale,
};

const wantJson = args.has("--json");

const wantAnySpecific =
  args.has("--iso") ||
  args.has("--epoch-ms") ||
  args.has("--epoch-s") ||
  args.has("--local");

if (wantJson) {
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exit(0);
}

if (!wantAnySpecific) {
  process.stdout.write(`${out.intl}\n`);
  process.stdout.write(`${out.iso}\n`);
  process.exit(0);
}

if (args.has("--iso")) process.stdout.write(`${out.iso}\n`);
if (args.has("--epoch-ms")) process.stdout.write(`${out.epochMs}\n`);
if (args.has("--epoch-s")) process.stdout.write(`${out.epochS}\n`);
if (args.has("--local")) process.stdout.write(`${out.local}\n`);

