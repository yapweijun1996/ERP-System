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
  },
});
