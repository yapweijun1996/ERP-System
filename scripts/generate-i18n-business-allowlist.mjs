import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'scripts/i18n-audit-allowlist.json');
const outputPath = path.join(root, 'web/public/assets/i18n-business.js');
const check = process.argv.includes('--check');
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const output = `/* Generated from scripts/i18n-audit-allowlist.json. */\nwindow.__ERP_I18N_BUSINESS_TEXT__=${JSON.stringify({
  exact: source.exactBusinessText,
  patterns: source.businessTextPatterns,
}, null, 2)};\n`;
if (check) {
  const current = readFileSync(outputPath, 'utf8');
  if (current !== output) throw new Error('i18n business allowlist is stale');
  console.log(`i18n business allowlist current (${source.exactBusinessText.length} exact values)`);
} else {
  writeFileSync(outputPath, output);
  console.log(`generated ${path.relative(root, outputPath)} (${source.exactBusinessText.length} exact values)`);
}
