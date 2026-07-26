import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const language = process.argv[2];
if (!['ms', 'zh', 'ja', 'vi'].includes(language)) {
  throw new Error('Usage: node scripts/translate-i18n-pack.mjs <ms|zh|ja|vi>');
}

const root = process.cwd();
const packDir = path.join(root, 'web/public/assets/i18n');
const english = JSON.parse(readFileSync(path.join(packDir, 'en.json'), 'utf8'));
const targetPath = path.join(packDir, `${language}.json`);
const target = JSON.parse(readFileSync(targetPath, 'utf8'));
const locale = { ms: 'ms', zh: 'zh-CN', ja: 'ja', vi: 'vi' }[language];

const keepIdentical = new Set([
  'CRM', 'CSV', 'GL', 'GST', 'ID', 'MTD', 'OK', 'PDF', 'SLA', 'SST', 'XLSX', 'YTD',
]);
const placeholders = (value) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]);

async function translate(value, attempt = 1) {
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
    const remaining = placeholders(translated).sort().join(',');
    if (remaining !== [...names].sort().join(',')) throw new Error('placeholder mismatch');
    if (/<\/?[a-z][^>]*>/i.test(translated)) throw new Error('unsafe markup');
    return translated;
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    return translate(value, attempt + 1);
  }
}

const candidates = Object.entries(english).filter(([key, value]) => {
  if (typeof value !== 'string' || target[key] !== value) return false;
  if (keepIdentical.has(value) || /^[-–—·#%+0-9. /]+$/.test(value)) return false;
  return true;
});

let cursor = 0;
let completed = 0;
async function worker() {
  while (cursor < candidates.length) {
    const index = cursor;
    cursor += 1;
    const [key, value] = candidates[index];
    target[key] = await translate(value);
    completed += 1;
    if (completed % 25 === 0 || completed === candidates.length) {
      console.log(`${language}: ${completed}/${candidates.length}`);
    }
  }
}

await Promise.all(Array.from({ length: 4 }, () => worker()));
const sorted = Object.fromEntries(Object.entries(target).sort(([left], [right]) => left.localeCompare(right)));
writeFileSync(targetPath, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`${language}: translated ${candidates.length} English fallback values`);
