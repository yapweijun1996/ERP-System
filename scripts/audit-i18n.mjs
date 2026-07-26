#!/usr/bin/env node
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const ASSET_DIR = path.join(ROOT, 'web/public/assets');
const PACK_DIR = path.join(ASSET_DIR, 'i18n');
const DIST_INDEX = path.join(ROOT, 'web/dist/index.html');
const ALLOWLIST = JSON.parse(readFileSync(path.join(ROOT, 'scripts/i18n-audit-allowlist.json'), 'utf8'));
const LANGUAGES = ['en', 'ms', 'zh', 'ja', 'vi'];
const TARGET_LANGUAGES = (process.env.I18N_LANGUAGES || 'ms,zh,ja,vi').split(',').filter((code) => code !== 'en');
const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 800 },
  { label: 'mobile', width: 375, height: 812 },
].filter((item) => !process.env.I18N_VIEWPORT || process.env.I18N_VIEWPORT === item.label);
const REPORT_ONLY = process.env.I18N_REPORT_ONLY === '1';
const PORT = process.env.I18N_AUDIT_PORT || '4312';
const BASE_URL = `http://localhost:${PORT}`;
const unsafeMarkup = /<\/?[a-z][^>]*>/i;
const placeholderSignature = (value) => [...new Set(String(value).match(/\{[A-Za-z][A-Za-z0-9_]*\}/g) || [])].sort().join(',');

function auditCanonicalPacks() {
  const errors = [];
  const warnings = [];
  const packs = Object.fromEntries(LANGUAGES.map((code) => {
    const filename = path.join(PACK_DIR, `${code}.json`);
    if (!existsSync(filename)) throw new Error(`Missing locale resource: ${filename}`);
    return [code, JSON.parse(readFileSync(filename, 'utf8'))];
  }));
  const englishKeys = Object.keys(packs.en);
  for (const code of LANGUAGES) {
    for (const [key, value] of Object.entries(packs[code])) {
      const values = typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value) : [];
      if (!values.length || values.some((item) => typeof item !== 'string')) errors.push(`${code}:${key} has an invalid value`);
      if (values.some((item) => unsafeMarkup.test(item))) errors.push(`${code}:${key} contains HTML/markup`);
      if (code !== 'en' && packs.en[key] != null && placeholderSignature(values.join(' ')) !== placeholderSignature(
        typeof packs.en[key] === 'string' ? packs.en[key] : Object.values(packs.en[key]).join(' '),
      )) errors.push(`${code}:${key} placeholder mismatch`);
    }
    if (code !== 'en') {
      const missing = englishKeys.filter((key) => packs[code][key] == null);
      missing.forEach((key) => warnings.push(`${code}:${key} missing; English fallback verified`));
    }
  }
  return { errors, warnings, keyCount: englishKeys.length };
}

function objectKeys(node, sourceFile) {
  if (!node || !ts.isObjectLiteralExpression(node)) return [];
  return node.properties.filter(ts.isPropertyAssignment).map((property) => property.name.getText(sourceFile).replace(/["'`]/g, ''));
}

function flattenObject(value, prefix = '', result = {}) {
  for (const [key, child] of Object.entries(value || {})) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') result[pathKey] = child;
    else if (child && typeof child === 'object' && !Array.isArray(child)) flattenObject(child, pathKey, result);
  }
  return result;
}

function auditLocalPacks() {
  const errors = [];
  let count = 0;
  for (const filename of readdirSync(ASSET_DIR).filter((name) => name.endsWith('.js'))) {
    const source = readFileSync(path.join(ASSET_DIR, filename), 'utf8');
    const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function walk(node) {
      if (ts.isObjectLiteralExpression(node)) {
        const keys = objectKeys(node, sourceFile);
        if (keys.includes('en') && keys.some((key) => LANGUAGES.slice(1).includes(key))) {
          count += 1;
          const missing = LANGUAGES.filter((key) => !keys.includes(key));
          if (missing.length) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            errors.push(`${filename}:${line} local pack missing ${missing.join(',')}`);
          }
          try {
            const pack = Function(`"use strict";return (${node.getText(sourceFile)});`)();
            const english = flattenObject(pack.en);
            for (const code of LANGUAGES.slice(1)) {
              if (!pack[code]) continue;
              const target = flattenObject(pack[code]);
              for (const [key, value] of Object.entries(english)) {
                if (target[key] == null) errors.push(`${filename}:${key} missing from local ${code} pack`);
                else if (placeholderSignature(target[key]) !== placeholderSignature(value)) errors.push(`${filename}:${key} placeholder mismatch in local ${code} pack`);
                else if (unsafeMarkup.test(target[key])) errors.push(`${filename}:${key} contains markup in local ${code} pack`);
              }
            }
          } catch { /* dynamic runtime values are checked by the browser matrix */ }
        }
      }
      ts.forEachChild(node, walk);
    }
    walk(sourceFile);
  }
  return { errors, count };
}

async function waitForServer(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch { /* retry until bounded timeout */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Preview did not start at ${BASE_URL}`);
}

async function startPreview() {
  const viteBin = path.join(ROOT, 'web/node_modules/vite/bin/vite.js');
  const processHandle = spawn(process.execPath, [viteBin, 'preview', '--port', PORT, '--strictPort'], {
    cwd: path.join(ROOT, 'web'), stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  processHandle.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  try {
    await waitForServer();
  } catch (error) {
    processHandle.kill();
    throw new Error(`${error.message}\n${stderr}`, { cause: error });
  }
  return processHandle;
}

function allowedBusinessText(value) {
  if (ALLOWLIST.exactBusinessText.includes(value)) return true;
  return ALLOWLIST.businessTextPatterns.some((pattern) => new RegExp(pattern).test(value));
}

async function auditBrowser() {
  if (!existsSync(DIST_INDEX)) throw new Error('web/dist is missing; run npm run build:demo first');
  const processHandle = await startPreview();
  const browser = await chromium.launch({ headless: true });
  const issues = [];
  const hardcoded = new Map();
  let routeCount = 0;
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
      const page = await context.newPage();
      const runtimeErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') runtimeErrors.push(message.text());
      });
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('aria-setup-wizard-complete', '1');
        localStorage.setItem('aria-demo-auth', JSON.stringify({ signedIn: true, email: 'admin@acme.co', at: new Date(0).toISOString() }));
        localStorage.setItem('aria-lang', 'en');
      });
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForSelector('.dashgrid', { timeout: 45000, state: 'visible' });
      const routes = await page.evaluate(() => Object.keys(SCREENS).sort());
      const screenMeta = await page.evaluate(() => JSON.parse(JSON.stringify(window.SCREEN_META || {})));
      routeCount = routes.length;
      for (const route of routes) {
        const fixture = screenMeta[route]?.fixture;
        const render = async (language) => page.evaluate(async ({ routeName, routeFixture, languageCode }) => {
          if (!await setLang(languageCode)) throw new Error(`setLang(${languageCode}) failed`);
          if (routeFixture === 'sales-enquiry') openTxn('enquiry', DB.enquiries[0]);
          else if (routeFixture === 'purchasing-rfq') openPurTxn('rfq', DB.rfqs[0]);
          else await navigate(routeName);
          const root = document.querySelector('#viewRoot');
          const directTexts = [];
          for (const element of root?.querySelectorAll('*') || []) {
            if (element.matches('script,style')) continue;
            if (element.closest('[data-i18n-format]')) continue;
            if (element.closest('[data-business-text]')) continue;
            for (const child of element.childNodes) {
              if (child.nodeType !== 3) continue;
              const value = (child.nodeValue || '').replace(/\s+/g, ' ').trim();
              if (value) directTexts.push(value);
            }
            for (const attribute of ['aria-label', 'title', 'placeholder', 'data-tip']) {
              const value = (element.getAttribute(attribute) || '').replace(/\s+/g, ' ').trim();
              if (value) directTexts.push(value);
            }
          }
          const translatedIdentical = new Set(Object.entries(I18N[languageCode] || {}).flatMap(([key, value]) =>
            typeof value === 'string' && value === I18N.en[key] ? [value] : []));
          return {
            lang: document.documentElement.lang,
            texts: [...new Set(directTexts)],
            translatedIdentical: [...translatedIdentical],
            rawKeys: [...new Set(directTexts.filter((value) => I18N.en[value] != null))],
            placeholders: [...new Set(directTexts.filter((value) => /\{[A-Za-z][A-Za-z0-9_]*\}/.test(value)))],
            overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            renderError: Boolean(root?.querySelector('.screen-render-error')),
          };
        }, { routeName: route, routeFixture: fixture, languageCode: language });

        const renderSafely = async (language) => {
          try {
            return await render(language);
          } catch (error) {
            if (!String(error?.message || error).includes('Execution context was destroyed')) throw error;
            await page.waitForLoadState('domcontentloaded');
            await page.waitForSelector('#viewRoot', { timeout: 45000 });
            return render(language);
          }
        };

        const english = await renderSafely('en');
        for (const language of TARGET_LANGUAGES) {
          const target = await renderSafely(language);
          if (target.lang !== { ms: 'ms-MY', zh: 'zh-Hans', ja: 'ja-JP', vi: 'vi-VN' }[language]) {
            issues.push(`${viewport.label}:${route}:${language} html lang=${target.lang}`);
          }
          target.rawKeys.forEach((value) => issues.push(`${viewport.label}:${route}:${language} raw key ${value}`));
          target.placeholders.forEach((value) => issues.push(`${viewport.label}:${route}:${language} unresolved placeholder ${value}`));
          if (target.overflow) issues.push(`${viewport.label}:${route}:${language} horizontal overflow`);
          if (target.renderError) issues.push(`${viewport.label}:${route}:${language} render error`);
          const identical = new Set(target.translatedIdentical);
          const targetTexts = new Set(target.texts);
          for (const value of english.texts) {
            if (!targetTexts.has(value) || identical.has(value) || allowedBusinessText(value)) continue;
            if (!/[A-Za-z]{2}/.test(value) || value.length < 3) continue;
            const key = `${route}:${value}`;
            if (!hardcoded.has(key)) hardcoded.set(key, { route, value, languages: new Set(), viewports: new Set() });
            hardcoded.get(key).languages.add(language);
            hardcoded.get(key).viewports.add(viewport.label);
          }
        }
      }
      runtimeErrors.forEach((message) => issues.push(`${viewport.label}: console ${message}`));
      await context.close();
    }
  } finally {
    await browser.close();
    processHandle.kill();
  }
  return {
    issues,
    routeCount,
    hardcoded: [...hardcoded.values()].map((item) => ({
      route: item.route, value: item.value,
      languages: [...item.languages], viewports: [...item.viewports],
    })),
  };
}

const canonical = auditCanonicalPacks();
const local = auditLocalPacks();
const staticErrors = [...canonical.errors, ...local.errors];
console.log(`i18n resources: ${canonical.keyCount} canonical keys; ${local.count} local five-language packs`);
canonical.warnings.forEach((warning) => console.warn(`WARN ${warning}`));
staticErrors.forEach((error) => console.error(`ERROR ${error}`));

let browserResult = { issues: [], hardcoded: [], routeCount: 0 };
if (process.argv.includes('--browser')) {
  browserResult = await auditBrowser();
  if (process.env.I18N_REPORT_PATH) {
    writeFileSync(path.resolve(process.env.I18N_REPORT_PATH), `${JSON.stringify(browserResult, null, 2)}\n`);
  }
  console.log(`i18n browser matrix: ${browserResult.routeCount} routes × ${1 + TARGET_LANGUAGES.length} languages × ${VIEWPORTS.length} viewports`);
  browserResult.issues.forEach((issue) => console.error(`ERROR ${issue}`));
  browserResult.hardcoded.forEach((item) => console.error(`HARDCODED ${item.route}: ${item.value}`));
}

const failureCount = staticErrors.length + browserResult.issues.length + browserResult.hardcoded.length;
if (failureCount && !REPORT_ONLY) {
  console.error(`i18n audit failed with ${failureCount} blocking finding(s).`);
  process.exitCode = 1;
} else if (failureCount) {
  console.warn(`i18n report contains ${failureCount} finding(s).`);
} else {
  console.log('i18n audit passed.');
}
