import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const assetDir = path.resolve('web/public/assets');
const languages = { ms: 'ms', zh: 'zh-CN', ja: 'ja', vi: 'vi' };
const keepIdentical = /^(?:AI|API|BOM|CRM|CSV|ERP|GL|GRN|GST|ID|MRP|MTD|OK|PDF|PWA|RFQ|SLA|SST|XLSX|YTD)$/;
const placeholders = (value) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]);

async function translate(value, locale, attempt = 1) {
  if (keepIdentical.test(value) || /^[-–—·#%+0-9. /]+$/.test(value)) return value;
  const names = placeholders(value);
  let protectedValue = value;
  names.forEach((name, index) => { protectedValue = protectedValue.replaceAll(`{${name}}`, `XQZPH${index}XQZ`); });
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

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function collectJobs(english, target, pathParts, jobs) {
  for (const [key, englishValue] of Object.entries(english || {})) {
    const currentPath = [...pathParts, key];
    const targetValue = target[key];
    if (typeof englishValue === 'string') {
      if (targetValue == null || (targetValue === englishValue && !keepIdentical.test(englishValue))) {
        jobs.push({ path: currentPath, value: englishValue });
      }
    } else if (englishValue && typeof englishValue === 'object' && !Array.isArray(englishValue)) {
      if (!targetValue || typeof targetValue !== 'object' || Array.isArray(targetValue)) target[key] = {};
      collectJobs(englishValue, target[key], currentPath, jobs);
    }
  }
}
function assignPath(target, pathParts, value) {
  let current = target;
  for (const key of pathParts.slice(0, -1)) current = current[key] ||= {};
  current[pathParts.at(-1)] = value;
}

const files = readdirSync(assetDir).filter((filename) => filename.endsWith('.js'));
const replacementsByFile = new Map();
const allJobs = [];
for (const filename of files) {
  const fullPath = path.join(assetDir, filename);
  const source = readFileSync(fullPath, 'utf8');
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function walk(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const properties = new Map(node.properties.filter(ts.isPropertyAssignment).map((property) => [property.name.getText(sourceFile).replace(/["'`]/g, ''), property]));
      if (properties.has('en') && [...properties.keys()].some((key) => Object.hasOwn(languages, key))) {
        try {
          const pack = Function(`"use strict";return (${node.getText(sourceFile)});`)();
          for (const [code, locale] of Object.entries(languages)) {
            const property = properties.get(code);
            if (!property || !ts.isObjectLiteralExpression(property.initializer)) continue;
            const completed = clone(pack[code] || {});
            const jobs = [];
            collectJobs(pack.en, completed, [], jobs);
            if (!jobs.length) continue;
            const record = { filename, start: property.initializer.getStart(sourceFile), end: property.initializer.getEnd(), completed, jobs, locale };
            if (!replacementsByFile.has(filename)) replacementsByFile.set(filename, []);
            replacementsByFile.get(filename).push(record);
            jobs.forEach((job) => allJobs.push({ ...job, record }));
          }
        } catch (error) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          console.warn(`${filename}:${line} skipped dynamic local pack: ${error.message}`);
        }
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(sourceFile);
}

let cursor = 0;
let completedCount = 0;
async function worker() {
  while (cursor < allJobs.length) {
    const index = cursor++;
    const job = allJobs[index];
    const translated = await translate(job.value, job.record.locale);
    assignPath(job.record.completed, job.path, translated);
    completedCount += 1;
    if (completedCount % 50 === 0 || completedCount === allJobs.length) console.log(`local packs: ${completedCount}/${allJobs.length}`);
  }
}
await Promise.all(Array.from({ length: 5 }, () => worker()));

for (const [filename, replacements] of replacementsByFile) {
  const fullPath = path.join(assetDir, filename);
  let source = readFileSync(fullPath, 'utf8');
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    source = source.slice(0, replacement.start) + JSON.stringify(replacement.completed, null, 2) + source.slice(replacement.end);
  }
  writeFileSync(fullPath, source);
}
console.log(`Completed ${allJobs.length} missing or English-fallback local translations across ${replacementsByFile.size} files.`);
