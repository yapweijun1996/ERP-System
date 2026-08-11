import { defineConfig } from 'vitest/config';

// Every test file boots its own in-memory PGlite instance (WASM Postgres) via
// src/test/helpers.ts's freshDb() and replays every migration on it. Vitest runs
// test files concurrently by default; as the migration count has grown (4 as of
// TASK-027), enough simultaneous PGlite boots under load can occasionally exceed
// the 5s default testTimeout — a resource-contention flake, not a logic failure
// (every such failure observed was `freshDb()` itself timing out, not an
// assertion). A generous headroom here trades a few seconds of worst-case local
// run time for a suite that doesn't intermittently fail in CI as more schema
// and tests are added over time.
export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 20000,
    // Each file owns a WASM PostgreSQL instance. With 74 migrations and the
    // EPIC-059 access seed, parallel file boots contend for the same CPU/memory
    // budget and turn otherwise-fast assertions into false hook timeouts.
    // Serialize files; individual tests still exercise real transaction races.
    fileParallelism: false,
    // Claude Code agent worktrees live under .claude/worktrees/ as full nested
    // checkouts of this repo (see `git worktree list`). Vitest's default
    // include glob is recursive with no awareness of them, so without this
    // exclude, running `npm test` while any background agent has an active
    // worktree silently pulls in that worktree's own *.test.ts files too —
    // against whatever mid-edit state its source happens to be in — and
    // reports the combined pass/fail count as if it were this checkout's own.
    // Confirmed 2026-07-20: a `npm test` run here showed 41 failures across 9
    // files that did not reproduce in isolation or in git status; `git
    // worktree list` revealed two concurrent agent worktrees, and every
    // failing file existed only under .claude/worktrees/**.
    // Playwright/Node E2E scripts are intentionally invoked by their own
    // `npm run test:e2e:*` commands; they are not Vitest suites.
    exclude: ['**/node_modules/**', '**/.claude/worktrees/**', '**/tests/e2e/**'],
  },
});
