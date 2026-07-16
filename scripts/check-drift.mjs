#!/usr/bin/env node
// Detects drift between the Drizzle-generated schema (source of truth) and the
// hand-copied SQL the browser demo boots into PGlite (TASK-020; the #1 landmine
// in docs/DESIGN.md section 3). Parses table/column definitions from both files
// and compares them semantically — not a raw byte diff, so incidental formatting
// or comment differences between regenerations don't produce false positives.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CORE_PATH = path.join(ROOT, 'drizzle', '0000_init.sql');
const DEMO_PATH = path.join(ROOT, 'web', 'public', 'db', 'erp-system-schema.sql');

/** table name -> Map(column name -> type declaration string) */
function parseTables(sql) {
  const tables = new Map();
  const tableRe = /CREATE TABLE IF NOT EXISTS "(\w+)"\s*\(([\s\S]*?)\n\);/g;
  let m;
  while ((m = tableRe.exec(sql))) {
    const [, name, body] = m;
    const columns = new Map();
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim().replace(/,$/, '');
      if (!line || line.startsWith('CONSTRAINT') || line.startsWith('--')) continue;
      const colMatch = line.match(/^"(\w+)"\s+(.+)$/);
      if (colMatch) columns.set(colMatch[1], colMatch[2].trim());
    }
    tables.set(name, columns);
  }
  return tables;
}

function relative(p) {
  return path.relative(ROOT, p);
}

const core = parseTables(readFileSync(CORE_PATH, 'utf8'));
const demo = parseTables(readFileSync(DEMO_PATH, 'utf8'));

if (core.size === 0) {
  console.error(`No tables parsed from ${relative(CORE_PATH)} — the parser or the file is broken. Refusing to report a false "no drift".`);
  process.exit(1);
}

const diffs = [];

for (const [table, coreCols] of core) {
  if (!demo.has(table)) {
    diffs.push(`- table "${table}": in ${relative(CORE_PATH)} but missing from ${relative(DEMO_PATH)}`);
    continue;
  }
  const demoCols = demo.get(table);
  for (const [col, coreType] of coreCols) {
    if (!demoCols.has(col)) {
      diffs.push(`- ${table}.${col}: missing from ${relative(DEMO_PATH)} (core: ${coreType})`);
    } else if (demoCols.get(col) !== coreType) {
      diffs.push(`- ${table}.${col}: type mismatch\n    core: ${coreType}\n    demo: ${demoCols.get(col)}`);
    }
  }
  for (const col of demoCols.keys()) {
    if (!coreCols.has(col)) {
      diffs.push(`- ${table}.${col}: present in ${relative(DEMO_PATH)} but not in ${relative(CORE_PATH)}`);
    }
  }
}
for (const table of demo.keys()) {
  if (!core.has(table)) {
    diffs.push(`- table "${table}": in ${relative(DEMO_PATH)} but missing from ${relative(CORE_PATH)}`);
  }
}

if (diffs.length) {
  console.error(`Schema drift detected between ${relative(CORE_PATH)} (source of truth) and ${relative(DEMO_PATH)} (hand-copied demo SQL):\n`);
  console.error(diffs.join('\n'));
  console.error(`\nFix: copy the corrected table/column definitions from ${relative(CORE_PATH)} into ${relative(DEMO_PATH)}. See docs/DESIGN.md section 3 (landmine #1).`);
  process.exit(1);
} else {
  console.log(`No schema drift: ${core.size} tables match between ${relative(CORE_PATH)} and ${relative(DEMO_PATH)}.`);
  process.exit(0);
}
