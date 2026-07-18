#!/usr/bin/env node
// Detects drift between the Drizzle-generated schema (source of truth) and the
// generated SQL the browser demo boots into PGlite (TASK-020; the #1 landmine
// in docs/DESIGN.md section 3). Parses table/column definitions and compares them
// semantically — not a raw byte diff, so incidental formatting or comment
// differences between regenerations don't produce false positives.
//
// `drizzle-kit generate` writes ONE SQL file per migration, not a rewritten
// snapshot — 0000_init.sql plus any later 000N_*.sql files together ARE the
// current schema. This script reads drizzle/meta/_journal.json for the
// authoritative migration order and applies each file's CREATE TABLE and (a
// deliberately small, growing-as-needed subset of) ALTER TABLE statements
// cumulatively, so it stays correct as new migrations are added.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DRIZZLE_DIR = path.join(ROOT, 'drizzle');
const JOURNAL_PATH = path.join(DRIZZLE_DIR, 'meta', '_journal.json');
const DEMO_PATH = path.join(ROOT, 'web', 'public', 'db', 'erp-system-schema.sql');

function relative(p) {
  return path.relative(ROOT, p);
}

const CORE_LABEL = 'drizzle/*.sql (all migrations)';

/** Apply CREATE TABLE + ALTER TABLE ADD COLUMN statements onto a running schema map. */
function applyMigration(tables, sql) {
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

  const addColRe = /ALTER TABLE "(\w+)" ADD COLUMN "(\w+)" (.+);/g;
  while ((m = addColRe.exec(sql))) {
    const [, table, col, type] = m;
    if (!tables.has(table)) {
      throw new Error(`ALTER TABLE ADD COLUMN on unknown table "${table}" — check-drift.mjs's migration parser needs updating for this migration's SQL shape.`);
    }
    tables.get(table).set(col, type.trim());
  }

  const dropColRe = /ALTER TABLE "(\w+)" DROP COLUMN "(\w+)";/g;
  while ((m = dropColRe.exec(sql))) {
    const [, table, col] = m;
    tables.get(table)?.delete(col);
  }
}

/** table name -> Map(column name -> type declaration string), built by replaying
 *  every migration in journal order. */
function buildCoreSchema() {
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'));
  const tables = new Map();
  for (const entry of journal.entries) {
    const migrationPath = path.join(DRIZZLE_DIR, `${entry.tag}.sql`);
    applyMigration(tables, readFileSync(migrationPath, 'utf8'));
  }
  return tables;
}

/** Single flat schema file — the demo copy is not incremental. */
function parseTables(sql) {
  const tables = new Map();
  applyMigration(tables, sql);
  return tables;
}

const core = buildCoreSchema();
const demo = parseTables(readFileSync(DEMO_PATH, 'utf8'));

if (core.size === 0) {
  console.error(`No tables parsed from drizzle/*.sql (via ${relative(JOURNAL_PATH)}) — the parser or the migrations are broken. Refusing to report a false "no drift".`);
  process.exit(1);
}

const diffs = [];

for (const [table, coreCols] of core) {
  if (!demo.has(table)) {
    diffs.push(`- table "${table}": in ${CORE_LABEL} but missing from ${relative(DEMO_PATH)}`);
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
      diffs.push(`- ${table}.${col}: present in ${relative(DEMO_PATH)} but not in ${CORE_LABEL}`);
    }
  }
}
for (const table of demo.keys()) {
  if (!core.has(table)) {
    diffs.push(`- table "${table}": in ${relative(DEMO_PATH)} but missing from ${CORE_LABEL}`);
  }
}

if (diffs.length) {
  console.error(`Schema drift detected between ${CORE_LABEL} (source of truth) and ${relative(DEMO_PATH)} (generated demo SQL):\n`);
  console.error(diffs.join('\n'));
  console.error(`\nFix: run npm run generate:demo-schema. See docs/DESIGN.md section 3 (landmine #1).`);
  process.exit(1);
} else {
  console.log(`No schema drift: ${core.size} tables match between ${CORE_LABEL} and ${relative(DEMO_PATH)}.`);
  process.exit(0);
}
