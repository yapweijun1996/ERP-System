# Contributing

## Branching

- `main` — integration branch; a pushed commit is not considered deployed until the
  release revision and public probes are recorded.
- Human feature branches may use `feat/<module>-<short>` / `fix/<short>`; Codex work
  uses the repository's `codex/` branch prefix unless the user requests otherwise.

## Commits

- Small, focused, present-tense (`add inventory stock_movement table`).
- One logical change per commit. Don't mix a refactor with a feature.

## Pull request checklist

- [ ] `npm run lint`, `npm run typecheck` and `npm run typecheck:web` pass.
- [ ] Builds in **both** modes (`npm run build:demo` and `npm run build`).
- [ ] Affected Vitest files pass; run and report the full `npm test` collection for a
      release candidate. Never report collected test counts as passed tests.
- [ ] `npm run check:demo-schema`, `npm run check:drift` and
      `npm run check:permissions` pass when their contracts are affected.
- [ ] Relevant screen, access-matrix, i18n and browser gates pass at desktop and 375px;
      record the revision, mode and command instead of inheriting an older result.
- [ ] New/changed large-table queries pass the
      [SCALABILITY checklist](docs/SCALABILITY.md#10-checklist-before-any-large-table-feature-ships)
      (no `SELECT *`, keyset pagination, tenant-leading index, `EXPLAIN` checked).
- [ ] Schema changes shipped as a Drizzle migration, not hand-edited SQL.
- [ ] A new commercial module is registered in `src/auth/moduleCatalog.ts`, allocated
      through the Platform-owned entitlement model, represented in
      `src/auth/permissionRegistry.ts` and seeded in the deterministic Demo harness.
- [ ] Docs updated if behavior or contracts changed.
- [ ] Security-sensitive changes include non-superuser PostgreSQL/RLS and downgrade/
      revocation tests where applicable; PGlite-only proof is insufficient.

## Architecture guardrails (reviewers enforce)

1. No write that touches **stock or money** may bypass the server in production.
2. Module business commands stay isolated, while the explicit central module,
   permission and navigation registries remain reviewed fail-closed control points.
3. Demo and production must share the same schema and migrations — no demo-only tables.
4. Every business query is tenant-scoped by `master_fn` + `company_fn` (from the session, never client input).

## Code style

- Keep domain commands in `src/modules/`, schemas in `src/data/schema/`, and API
  authorization/tenant derivation in `src/api/` and `src/auth/`.
- The classic frontend under `web/public/assets/` remains vanilla JavaScript with a
  fixed script order; the shared bundled browser runtime belongs in `web/src/`.
- Run `npm run lint` before pushing.

## Reporting issues

Include: mode (demo/production), steps to reproduce, expected vs actual, and — for
production data issues — approximate table size (the fix at 1 GB differs from 800 GB).
