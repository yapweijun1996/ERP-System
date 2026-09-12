# TASK-237 CI gate wiring evidence — 2026-09-13

- Date: 2026-09-13 (Asia/Singapore)
- Code revision: `356a68b788d161664e4e1584e08739bc47917be6`
- Gate implementation: `72ee850609ed369c928f71d7117f6e84d845775e`
- Environment: local repository, GitHub Actions YAML and shell-step simulation
- Evidence class: local CI-path wiring; no remote CI, provider, production or rollout claim
- Actor: Codex engineering run in the shared ERP-System worktree
- Working-tree boundary: pre-existing unrelated tracked and untracked changes were preserved; the code revision changes only `.github/workflows/ci.yml`.

## Expected result

The existing `validate` job must run the canonical deterministic Receipt Pilot gate. A
normal fixture must succeed. A deliberately broken fixture must return nonzero and
contain the stable `receipt_pilot_evaluation_gate_failed:P06-create-sg` marker; an
unexpected success must fail the CI step.

## Actual result

- `.github/workflows/ci.yml` now runs `npm run check:receipt-pilot-evaluation` after
  both typechecks.
- The following step captures the broken-fixture output, rejects an unexpected zero
  exit, and checks the stable failure marker with `grep -Fq`.
- `yq -e '.' .github/workflows/ci.yml` parsed the workflow successfully.
- The local CI-step simulation returned normal gate exit 0 with 30/30 valid and 9/9
  negative cases, then returned broken gate exit 1 with the expected P06 marker.

## Verification

| Command | Expected | Actual |
| --- | --- | --- |
| `yq -e '.' .github/workflows/ci.yml` | Workflow YAML parses | Passed |
| `npm run check:receipt-pilot-evaluation` | Deterministic gate succeeds | Exit 0; 30/30 valid, 9/9 negative rejected |
| `npm run check:receipt-pilot-evaluation -- --broken` | Broken fixture fails closed | Exit 1; `P06-create-sg` marker |
| Local CI-step shell simulation | CI logic preserves both exit decisions | Passed; normal 0, broken 1 |
| `npx vitest run src/pilot/evaluationCases.test.ts --reporter=dot` | Gate regression remains green | 1 file, 8 tests passed |
| `npm run lint` / `npm run typecheck` / `npm run typecheck:web` | Common static gates pass | Passed |
| `git diff --check` | No whitespace errors | Passed |

## Acceptance boundary

This records CI-path wiring and a local simulation only. It does not claim a remote
GitHub Actions run, three live model evaluations, approved provider scope, latency or
cost budgets, failed rollout retention, emergency disable, production deployment or
business-owner acceptance. TASK-237 remains Todo; S5 remains unchecked until the
workflow runs in CI and the version-change, rollout and disable evidence is recorded.

The workflow is [ci.yml](../../../.github/workflows/ci.yml), and the canonical gate is
[check-receipt-pilot-evaluation](../../../package.json).
