#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DOCUMENT_ROOTS = [
  path.join(ROOT, 'README.md'),
  path.join(ROOT, 'docs'),
];

function markdownFiles(target) {
  if (target.endsWith('.md')) return [target];
  const files = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(entryPath);
  }
  return files;
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function localDestination(rawDestination) {
  const destination = rawDestination.trim();
  if (!destination || destination.startsWith('#') || destination.startsWith('//')) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(destination)) return null;
  const target = destination.split(/[?#]/, 1)[0];
  if (!target || target.startsWith('/')) return null;
  return target;
}

const files = DOCUMENT_ROOTS.flatMap(markdownFiles).sort();
const missing = [];
let checkedLinks = 0;
const linkPattern = /(?<!!)\[[^\]]*\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+[^)]*)?\)/g;

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  let match;
  while ((match = linkPattern.exec(source))) {
    const rawDestination = match[1].startsWith('<')
      ? match[1].slice(1, -1)
      : match[1];
    const target = localDestination(rawDestination);
    if (!target) continue;
    checkedLinks += 1;
    const resolved = path.resolve(path.dirname(file), target);
    if (!statSafe(resolved)) {
      missing.push(`${path.relative(ROOT, file)}:${lineNumber(source, match.index)} -> ${rawDestination}`);
    }
  }
}

function statSafe(target) {
  try {
    statSync(target);
    return true;
  } catch {
    return false;
  }
}

if (missing.length) {
  console.error(`Documentation link check failed: ${missing.length} missing local target(s).`);
  console.error(missing.join('\n'));
  process.exit(1);
}

console.log(`Documentation link check passed: ${files.length} Markdown files, ${checkedLinks} local links.`);
