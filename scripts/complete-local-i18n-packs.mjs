import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const targets = [
  'web/public/assets/screens-settings.js',
  'web/public/assets/screens-setup-wizard.js',
];
const targetLocales = { ja: 'ja', vi: 'vi' };
const placeholders = (value) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]);
const keepIdentical = /^(?:AI|API|CRM|CSV|ERP|GL|GST|ID|MTD|OK|PDF|PGlite|PostgreSQL|SLA|SST|XLSX|YTD)$/;

async function translate(value, locale, attempt = 1) {
  if (keepIdentical.test(value) || /^[-–—·#%+0-9. /]+$/.test(value)) return value;
  const names = placeholders(value);
  let protectedValue = value;
  names.forEach((name, index) => {
    protectedValue = protectedValue.replaceAll(`{${name}}`, `XQZPH${index}XQZ`);
  });
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', locale);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', protectedValue);
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'ERP-System i18n maintenance' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    let translated = body[0].map((part) => part[0]).join('');
    names.forEach((name, index) => {
      translated = translated.replaceAll(`XQZPH${index}XQZ`, `{${name}}`);
      translated = translated.replaceAll(`XQZ PH ${index} XQZ`, `{${name}}`);
    });
    if (placeholders(translated).sort().join(',') !== [...names].sort().join(',')) throw new Error('placeholder mismatch');
    if (/<\/?[a-z][^>]*>/i.test(translated)) throw new Error('unsafe markup');
    return translated;
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    return translate(value, locale, attempt + 1);
  }
}

async function translateObject(source, locale) {
  const entries = Object.entries(source);
  const result = {};
  let cursor = 0;
  async function worker() {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;
      const [key, value] = entries[index];
      result[key] = typeof value === 'string' ? await translate(value, locale) : value;
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  return Object.fromEntries(entries.map(([key]) => [key, result[key]]));
}

function findCopyObject(source, filename) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let found;
  function walk(node) {
    if (!found && ts.isVariableDeclaration(node) && node.name.getText(file) === 'COPY' &&
      node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      const keys = node.initializer.properties.filter(ts.isPropertyAssignment).map((property) => property.name.getText(file).replace(/["'`]/g, ''));
      if (keys.includes('en')) found = node.initializer;
    }
    ts.forEachChild(node, walk);
  }
  walk(file);
  if (!found) throw new Error(`COPY object not found in ${filename}`);
  return found;
}

for (const relativePath of targets) {
  const filename = path.resolve(relativePath);
  let source = readFileSync(filename, 'utf8');
  const objectNode = findCopyObject(source, filename);
  const pack = Function(`"use strict";return (${objectNode.getText()});`)();
  const missing = Object.keys(targetLocales).filter((code) => !pack[code]);
  if (!missing.length) {
    console.log(`${relativePath}: already complete`);
    continue;
  }
  const additions = [];
  for (const code of missing) {
    console.log(`${relativePath}: translating ${code}`);
    const translated = await translateObject(pack.en, targetLocales[code]);
    additions.push(`${JSON.stringify(code)}:${JSON.stringify(translated, null, 2).replaceAll('\n', '\n    ')}`);
  }
  const insertion = `\n    ${additions.join(',\n    ')},`;
  const insertAt = objectNode.getEnd() - 1;
  source = source.slice(0, insertAt) + insertion + source.slice(insertAt);
  writeFileSync(filename, source);
  console.log(`${relativePath}: added ${missing.join(', ')}`);
}
