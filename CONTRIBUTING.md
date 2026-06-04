# Contributing

## Branching

- `main` — stable. Demo deploys from here.
- Feature branches: `feat/<module>-<short>`, fixes: `fix/<short>`.

## Commits

- Small, focused, present-tense (`add inventory stock_movement table`).
- One logical change per commit. Don't mix a refactor with a feature.

## Pull request checklist

- [ ] Builds in **both** modes (`npm run build:demo` and `npm run build`).
- [ ] `npm test` passes (paste output in the PR).
- [ ] New/changed large-table queries pass the
      [SCALABILITY checklist](docs/SCALABILITY.md#10-checklist-before-any-large-table-feature-ships)
      (no `SELECT *`, keyset pagination, tenant-leading index, `EXPLAIN` checked).
- [ ] Schema changes shipped as a Drizzle migration, not hand-edited SQL.
- [ ] New module registered in `core/module-registry` and seeded for the demo.
- [ ] Docs updated if behavior or contracts changed.

## Architecture guardrails (reviewers enforce)

1. No write that touches **stock or money** may bypass the server in production.
2. Adding a module must not require editing another module.
3. Demo and production must share the same schema and migrations — no demo-only tables.
4. Every business query is tenant-scoped by `master_fn` + `company_fn` (from the session, never client input).

## Code style

- TypeScript everywhere; business logic in `src/shared/` stays isomorphic (no
  server-only globals).
- Run `npm run lint` before pushing.

## Reporting issues

Include: mode (demo/production), steps to reproduce, expected vs actual, and — for
production data issues — approximate table size (the fix at 1 GB differs from 800 GB).
