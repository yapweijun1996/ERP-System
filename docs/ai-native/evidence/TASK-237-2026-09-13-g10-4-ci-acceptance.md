# TASK-237 G10.4 acceptance evidence — evaluator-gated CI and emergency disable

- Date: 2026-09-13 (Asia/Singapore)
- Candidate revision: `b695a833ace3983149dd3728bbb1124fd010b250`
- Branch: `codex/receipt-pilot-release-20260913`
- Environment: GitHub Actions CI with disposable PostgreSQL 16 and cached Playwright Chromium; local Node/Vitest probe
- Actor: Codex engineering run and GitHub Actions service account
- Working-tree boundary: unrelated tracked and untracked changes were preserved.

## Expected result

Gate model, prompt and tool changes with the same Receipt Pilot evaluations;
record the environment and evidence artifact; reject a failed rollout and block
subsequent rollout after emergency disable.

## Actual result

The candidate's CI workflow runs the same deterministic evaluator used by the
release probe, then runs the deliberately broken fixture and the rollout/
emergency-disable probe before the remaining repository gates. The repaired
candidate run completed successfully:

- [GitHub Actions run 34746493412](https://github.com/yapweijun1996/ERP-System/actions/runs/34746493412) completed with `success` at the expected head SHA.
- The combined validation job passed deterministic evaluation, broken-fixture
  fail-closed behavior, and rollout/emergency-disable steps, followed by
  generated-schema, PostgreSQL security/concurrency, Demo, i18n, browser,
  layout, public-subpath and cleanup checks.
- The local release probe rejected a broken candidate with
  `receipt_pilot_evaluation_gate_failed` while preserving the baseline
  generation; accepted a valid prompt-version candidate; then incremented the
  generation and set `enabled=false` through emergency disable. A subsequent
  rollout returned `receipt_pilot_release_disabled` without evaluating or
  replacing the disabled state.
- Version metadata is carried through the evaluator and release state, so a
  prompt/model/tool change cannot bypass the same case gate.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npx vitest run src/pilot/evaluationReleaseProbe.test.ts src/pilot/evaluationCases.test.ts --reporter=dot` | Candidate rejection, version advancement and disable behavior pass | 2 files / 10 tests passed (235 ms) |
| `npm run check:receipt-pilot-rollout` | Broken candidate rejected, valid candidate accepted, disabled state blocks rollout | Passed with the expected three states and codes |
| `gh run view 34746493412 --repo yapweijun1996/ERP-System --json status,conclusion,headSha,jobs` | Remote CI executes the same evaluator and release probes | `completed`, `success`, head `b695a833`; all listed jobs/steps passed |

## Boundary

This evidence accepts **G10.4** for the source/CI release-control boundary. It
does not mark TASK-237 complete or check S5, because a production rollout,
retention window and production emergency-disable observation are still absent.
Real provider/OCR execution, owner-approved budgets, human acceptance and
production evidence remain separate. No secrets or raw receipt payloads were
recorded.
