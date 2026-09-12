# TASK-204 — Effective-date ambiguity guard handoff

Date: 2026-09-13, Asia/Singapore. This record covers a local source and
fixture increment for TASK-204. It does not approve SG/MY tax policy, change
production configuration, or make a statutory-compliance claim.

## Identity and scope

- **Task:** TASK-204, qualified SG/MY tax-owner review.
- **Selected gap:** the shared effective-date lookup previously selected one
  matching row even when overlapping Company-scoped rules made the tax fact
  ambiguous.
- **Expected result:** preserve the inclusive `validFrom` / exclusive `validTo`
  interval, return a rule only when exactly one row matches the authenticated
  `masterFn` + `companyFn` scope, and make overlapping dates fail closed.
- **Actor / environment:** Codex on local macOS, root `main`, PGlite fixtures;
  no production database, migration, provider, alert sink, deployment or
  secret was used.
- **Baseline:** the worktree contained unrelated tracked and untracked changes;
  they remain preserved. Before the focused commit, no files were staged and
  there were no unmerged paths.

## Implementation and observed result

Commit `f178dffe93176d15d888f8ecfef8b684eaad279c` (`Fail closed on ambiguous tax
rule dates`) contains exactly:

- `src/data/repo.ts`: inspect up to two matching rules and return `null` unless
  exactly one row matches; ordering is deterministic for inspection.
- `src/data/repo.test.ts`: prove overlap rejection and isolation of identical
  tax codes across Company and tax regime, including a mismatched Master.
- `src/modules/purchasing/purchaseReturn.test.ts`: avoid inserting a duplicate
  synthetic rule when the fixture is reused, so the intended purchase-return
  assertion is not masked by the ambiguity guard.

The existing posting callers continue to receive the same shared `Scope`; a
missing rule therefore follows their existing fail-closed tax error path. No
tax rate, classification, recoverability or production row was changed.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npm test -- --run src/data/repo.test.ts src/modules/localization/tax.test.ts src/modules/purchasing/purchaseReturn.test.ts --reporter=dot` | Boundary and fixture tests pass | 3 files / 23 tests passed |
| `npm test -- --run src/data/repo.test.ts src/modules/localization/tax.test.ts src/modules/purchasing src/modules/sales src/modules/expenses/policy.test.ts --reporter=dot` | Affected tax callers preserve normal behavior | 22 files / 126 tests passed |
| `npm run lint` | No errors or warnings | Exit 0 |
| `npm run typecheck` and `npm run typecheck:web` | Type checks pass | Exit 0 |
| `npm run demo` | Demo/PGlite transaction, tax, stock and GL proof passes | Exit 0; no `POSTGRES_URL` configured |
| `npm run build:demo` | Demo bundle builds | Exit 0; existing Vite warnings only |
| `npm run docs:check` | Documentation links pass | 89 Markdown files / 811 local links |
| `git diff --check` and `git diff --cached --check` | No whitespace errors | Exit 0 |

The post-record root review also passed: `GOAL.md`, `PROGRESS.md` and
`GOAL_PROMPT.md` contained 178 local links with 0 missing files or fragments.

## Acceptance boundary

This increment strengthens the source-level and Demo/PGlite portion of the
effective-date and tenant-isolation contract. TASK-204 remains `in_progress`.
The remaining acceptance requires a qualified tax owner to select authoritative
SG/MY source versions, approve category-specific rates/exemptions/thresholds and
transitions, review the actual production `tax_rule` configuration, and record
the approver role and review timestamp. The Malaysia rental/leasing source
conflict documented in the 2026-09-11 review remains unresolved; no seeded row
was silently replaced.

## Current handoff

- **Source revision:** `f178dffe93176d15d888f8ecfef8b684eaad279c` on `main`.
- **Evidence-record revision:** `389530b49a9606d7e778177dfede0067f0cc9cd0`.
- **Repository state:** `main` is 20 commits ahead of `origin/main`; 37 dirty
  paths remain, no unmerged paths exist, and the index is empty. The dirty paths
  include pre-existing documentation, HR, receipt and task-registry work and
  were not included in this focused commit.
- **KB readback:** item `bedbace4-df19-4ce0-882c-b9274b1f654d` was read back from
  `erp-system-project-logic`; the KB reports 133 items / 133 embedded items.
- **Registry / GOAL counts:** unchanged at 227 done, 6 in progress, 4 todo and
  3 blocked across 240 tasks; 31/48 criteria, 41/60 checkpoints; no
  dependency-ready Todo. This source increment does not satisfy qualified-owner
  acceptance and therefore does not change counts.
- **Next measurable action:** qualified tax-owner review of the authoritative
  source/version and production configuration; after that decision, add the
  governed dated rule/transition fixture and rerun the tax posting gates.
