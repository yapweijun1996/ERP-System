import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'web/public/assets/i18n/en.json');
const outputPath = path.join(root, 'web/public/assets/i18n-en.js');
const check = process.argv.includes('--check');
const pack = JSON.parse(readFileSync(sourcePath, 'utf8'));

const output = `/* Generated from assets/i18n/en.json. Do not edit directly. */\n`+
  `window.__ERP_I18N_EN__=Object.freeze(${JSON.stringify(pack, null, 2)});\n`;

if (check) {
  const current = readFileSync(outputPath, 'utf8');
  if (current !== output) {
    throw new Error('i18n-en.js is stale; run npm run generate:i18n-bootstrap.');
  }
  console.log(`i18n bootstrap current (${Object.keys(pack).length} English keys)`);
} else {
  writeFileSync(outputPath, output);
  console.log(`generated ${path.relative(root, outputPath)} (${Object.keys(pack).length} English keys)`);
}
