import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Three genuinely different JS/TS environments live in this repo (see
// CLAUDE.md): Node/Express business logic under src/, a Vite+TS browser
// bundle under web/src/, and a vanilla-JS frontend under web/public/assets/
// loaded as classic (non-module) <script> tags in a fixed order, all sharing
// one global scope by design (CLAUDE.md landmine #4/#5) — a function or
// const declared in one file is routinely called from another with no
// import. That last environment needs its own rule set below; see the
// comment on that block for why.
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'build/**',
      '.claude/**',
      'drizzle/**',
      'web/public/db/**',
    ],
  },

  // Root TypeScript: business logic, API server, Drizzle/Vitest config.
  {
    files: ['src/**/*.ts', '*.config.ts', 'scripts/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Both found only in deliberate, judged-safe spots as of the initial
      // rollout (generic ResourceDefinition framework typing where Drizzle's
      // real column/table types would need heavy generics for no real
      // benefit; a Drizzle self-referencing-FK escape hatch; test-only casts;
      // `interface X extends Y {}` used purely as a semantic rename). Kept as
      // a warning rather than fully off so a genuinely lazy new `any` still
      // gets a nudge.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },

  // Node ESM helper scripts (audit/smoke/drift/schema-generation). Two of
  // these (audit-screens.mjs, smoke.mjs) drive Playwright and pass callbacks
  // to page.evaluate() whose bodies execute inside the loaded app's own
  // browser page, not this Node process — referencing that page's globals
  // (standard ones like window/document, AND this app's own SCREENS/DB/
  // navigate/ROUTE_MODULE/openTxn/openPurTxn from web/public/assets/**).
  // no-undef is off here for the same reason it's off for that glob below:
  // no per-file linter can distinguish "real typo" from "this app's own
  // global, live in the page being evaluated" without re-deriving the same
  // ~300+-identifier allowlist a second time.
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-undef': 'off',
    },
  },

  // web/src: browser TypeScript bundled by Vite.
  {
    files: ['web/src/**/*.ts', 'web/*.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // web/public/assets: vanilla JS, classic scripts sharing one global scope
  // across ~70 load-ordered files (~300+ cross-file identifiers — SCREENS,
  // listPage, requireField, MODULE_DEFS, ...). no-undef is deliberately off:
  // a per-file linter cannot see "declared in screens-common.js, used in
  // screens-admin.js" without a hand-maintained global allowlist, and that
  // allowlist would itself become a stale, high-friction liability in a
  // frontend this size. no-unused-vars is scoped to `vars: 'local'` so it
  // still catches genuinely dead variables *inside* a function without
  // flagging top-level declarations, which are usually public API for other
  // files, not dead code. allowEmptyCatch matches this codebase's established
  // (and correct) convention of silently ignoring optional localStorage/
  // history-API calls that can throw in private-browsing/sandboxed contexts.
  // skipTemplates lets deliberately-chosen Unicode spacing (e.g. an en-space
  // around a "·" separator in UI copy) live inside the template-literal HTML
  // these screens are built from without tripping irregular-whitespace.
  {
    files: ['web/public/assets/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': ['warn', { vars: 'local', args: 'after-used' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-irregular-whitespace': ['error', { skipTemplates: true }],
    },
  },

  // Service worker: its own global scope (self, caches, clients — not window).
  {
    files: ['web/public/sw.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.serviceworker },
    },
    rules: {
      'no-unused-vars': ['warn', { vars: 'local', args: 'after-used' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);
