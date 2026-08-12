#!/usr/bin/env node
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const ASSET_DIR = path.join(ROOT, 'web/public/assets');
const PACK_DIR = path.join(ASSET_DIR, 'i18n');
const DIST_INDEX = path.join(ROOT, 'web/dist/index.html');
const ALLOWLIST = JSON.parse(readFileSync(path.join(ROOT, 'scripts/i18n-audit-allowlist.json'), 'utf8'));
const LANGUAGES = ['en', 'ms', 'zh', 'ja', 'vi'];
const MATRIX_LANGUAGES = [...new Set((process.env.I18N_LANGUAGES || LANGUAGES.join(','))
  .split(',').map((code) => code.trim()).filter(Boolean))];
const invalidLanguages = MATRIX_LANGUAGES.filter((code) => !LANGUAGES.includes(code));
if (invalidLanguages.length) {
  throw new Error(`Unsupported I18N_LANGUAGES value(s): ${invalidLanguages.join(', ')}`);
}
const TARGET_LANGUAGES = MATRIX_LANGUAGES.filter((code) => code !== 'en');
const ALL_VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 800 },
  { label: 'mobile', width: 375, height: 812 },
];
const requestedViewports = (process.env.I18N_VIEWPORTS || process.env.I18N_VIEWPORT || 'desktop,mobile')
  .split(',').map((label) => label.trim()).filter(Boolean);
const invalidViewports = requestedViewports.filter((label) => !ALL_VIEWPORTS.some((item) => item.label === label));
if (invalidViewports.length) {
  throw new Error(`Unsupported I18N_VIEWPORT(S) value(s): ${invalidViewports.join(', ')}`);
}
const VIEWPORTS = requestedViewports
  .map((label) => ALL_VIEWPORTS.find((item) => item.label === label))
  .filter(Boolean);
if (!VIEWPORTS.length) throw new Error('I18N_VIEWPORT(S) must select at least one viewport.');
const ROUTE_FILTER = new Set((process.env.I18N_ROUTES || '')
  .split(',').map((route) => route.trim()).filter(Boolean));
const ROUTE_TIMEOUT_MS = Number(process.env.I18N_ROUTE_TIMEOUT_MS || 15000);
if (!Number.isFinite(ROUTE_TIMEOUT_MS) || ROUTE_TIMEOUT_MS < 1000) {
  throw new Error('I18N_ROUTE_TIMEOUT_MS must be a number >= 1000.');
}
const SETTLE_MS = Number(process.env.I18N_SETTLE_MS || 100);
if (!Number.isFinite(SETTLE_MS) || SETTLE_MS < 0) {
  throw new Error('I18N_SETTLE_MS must be a non-negative number.');
}
const BOOT_TIMEOUT_MS = Number(process.env.I18N_BOOT_TIMEOUT_MS || 60000);
if (!Number.isFinite(BOOT_TIMEOUT_MS) || BOOT_TIMEOUT_MS < 1000) {
  throw new Error('I18N_BOOT_TIMEOUT_MS must be a number >= 1000.');
}
const PAGE_BOOT_TIMEOUT_MS = Number(process.env.I18N_PAGE_BOOT_TIMEOUT_MS || 45000);
if (!Number.isFinite(PAGE_BOOT_TIMEOUT_MS) || PAGE_BOOT_TIMEOUT_MS < 1000) {
  throw new Error('I18N_PAGE_BOOT_TIMEOUT_MS must be a number >= 1000.');
}
const REQUIRE_PGLITE = process.env.I18N_REQUIRE_PGLITE === '1';
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
        const englishProperty = node.properties.find((property) => ts.isPropertyAssignment(property)
          && property.name.getText(sourceFile).replace(/["'`]/g, '') === 'en');
        // A small scalar map such as { en:'...', ms:'...' } is already a
        // complete translation map, not a nested local pack. Only audit
        // language objects here; treating the English string as an object
        // creates false numeric keys (one per character).
        if (keys.includes('en') && keys.some((key) => LANGUAGES.slice(1).includes(key))
          && englishProperty && ts.isObjectLiteralExpression(englishProperty.initializer)) {
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

function timeoutError(label, timeoutMs) {
  return new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function evaluateWithTimeout(page, expression, argument, label, timeoutMs = ROUTE_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      page.evaluate(expression, argument),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(timeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function expectedLocale(language) {
  return { en: 'en', ms: 'ms-MY', zh: 'zh-Hans', ja: 'ja-JP', vi: 'vi-VN' }[language];
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
      await context.addInitScript(() => {
        localStorage.setItem('aria-setup-wizard-complete', '1');
        localStorage.setItem('aria-demo-auth', JSON.stringify({ signedIn: true, email: 'admin@acme.co', at: new Date(0).toISOString() }));
        localStorage.setItem('aria-lang', 'en');
      });

      const openPage = async () => {
        const nextPage = await context.newPage();
        const runtimeErrors = [];
        nextPage.on('console', (message) => {
          if (message.type() === 'error') runtimeErrors.push(message.text());
        });
        nextPage.on('pageerror', (error) => runtimeErrors.push(error.message));
        await nextPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await nextPage.waitForSelector('.dashgrid', { timeout: PAGE_BOOT_TIMEOUT_MS, state: 'visible' });
        await evaluateWithTimeout(nextPage, async ({ requirePglite }) => {
          const runtimeReady = window.ErpDemoRuntimeReady;
          if (runtimeReady && typeof runtimeReady.then === 'function') await runtimeReady;
          const adapterReady = window.ErpSystemDataReady;
          if (adapterReady && typeof adapterReady.then === 'function') await adapterReady;
          if (!window.ErpSystemData || typeof window.ErpSystemData.list !== 'function') {
            throw new Error('ErpSystemData is not ready');
          }
          if (requirePglite && window.ErpSystemData.mode !== 'pglite') {
            throw new Error(`Demo adapter mode=${window.ErpSystemData.mode}; expected pglite`);
          }
        }, { requirePglite: REQUIRE_PGLITE }, `${viewport.label}:demo readiness`, BOOT_TIMEOUT_MS);
        return { page: nextPage, runtimeErrors };
      };

      let pageState = await openPage();
      const drainRuntimeErrors = (scope) => {
        const messages = pageState.runtimeErrors.splice(0);
        messages.forEach((message) => issues.push(`${viewport.label}:${scope}: console ${message}`));
      };
      const recyclePage = async (scope) => {
        drainRuntimeErrors(scope);
        await pageState.page.close().catch(() => {});
        pageState = await openPage();
        drainRuntimeErrors('boot');
      };

      const routesFromPage = await evaluateWithTimeout(
        pageState.page,
        () => Object.keys(SCREENS).sort(),
        undefined,
        `${viewport.label}:route discovery`,
      );
      const screenMeta = await evaluateWithTimeout(
        pageState.page,
        () => JSON.parse(JSON.stringify(window.SCREEN_META || {})),
        undefined,
        `${viewport.label}:screen metadata discovery`,
      );
      const routes = ROUTE_FILTER.size
        ? routesFromPage.filter((route) => ROUTE_FILTER.has(route))
        : routesFromPage;
      routeCount = routes.length;
      console.log(`[${viewport.label}] Found ${routes.length} routes registered in SCREENS.`);
      for (const route of routes) {
        const fixture = screenMeta[route]?.fixture;
        let english = null;
        const renderSafely = async (language) => {
          console.log(`[${viewport.label}] ${route} — ${language}`);
          try {
            const result = await evaluateWithTimeout(pageState.page, async ({ routeName, routeFixture, languageCode, settleMs }) => {
              if (!await setLang(languageCode)) throw new Error(`setLang(${languageCode}) failed`);
              if (routeFixture === 'sales-enquiry') {
                if (!DB.enquiries?.[0]) throw new Error('sales-enquiry fixture has no record');
                await Promise.resolve(openTxn('enquiry', DB.enquiries[0]));
              } else if (routeFixture === 'purchasing-rfq') {
                if (!DB.rfqs?.[0]) throw new Error('purchasing-rfq fixture has no record');
                await Promise.resolve(openPurTxn('rfq', DB.rfqs[0]));
              } else {
                await navigate(routeName);
              }
              await new Promise((resolve) => setTimeout(resolve, settleMs));
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
            }, { routeName: route, routeFixture: fixture, languageCode: language, settleMs: SETTLE_MS }, `${viewport.label}:${route}:${language}`);
            drainRuntimeErrors(`${route}:${language}`);
            console.log(`[${viewport.label}] ${route} — ${language} OK`);
            return result;
          } catch (error) {
            const message = String(error?.message || error);
            issues.push(`${viewport.label}:${route}:${language} ${message}`);
            console.error(`[${viewport.label}] ${route} — ${language} FAILED: ${message}`);
            await recyclePage(`${route}:${language}`);
            return null;
          }
        };

        english = await renderSafely('en');
        if (english?.renderError) issues.push(`${viewport.label}:${route}:en render error`);
        for (const language of TARGET_LANGUAGES) {
          const target = await renderSafely(language);
          if (!target) continue;
          if (target.lang !== expectedLocale(language)) {
            issues.push(`${viewport.label}:${route}:${language} html lang=${target.lang}`);
          }
          target.rawKeys.forEach((value) => issues.push(`${viewport.label}:${route}:${language} raw key ${value}`));
          target.placeholders.forEach((value) => issues.push(`${viewport.label}:${route}:${language} unresolved placeholder ${value}`));
          if (target.overflow) issues.push(`${viewport.label}:${route}:${language} horizontal overflow`);
          if (target.renderError) issues.push(`${viewport.label}:${route}:${language} render error`);
          if (english) {
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
      }
      drainRuntimeErrors('final');
      await context.close();
    }
  } finally {
    await browser.close();
    processHandle.kill();
  }
  return {
    issues,
    routeCount,
    languages: ['en', ...TARGET_LANGUAGES],
    viewports: VIEWPORTS.map(({ label }) => label),
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
    const reportPath = path.resolve(process.env.I18N_REPORT_PATH);
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(browserResult, null, 2)}\n`);
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
