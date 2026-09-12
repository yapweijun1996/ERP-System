# TASK-237 S2 evidence — deterministic Receipt Pilot gate

- Date: 2026-09-13 (Asia/Singapore)
- Revision: `8bc9f1bf53563eced4d90f7ba869390e1602b3a1`
- Environment: local repository, Node/tsx/Vitest, symbolic isolated fixture metadata
- Evidence class: deterministic fixture gate; no model/provider, production, CI or human-pilot claim
- Actor: Codex engineering run in the shared ERP-System worktree
- Working-tree boundary: pre-existing unrelated tracked and untracked changes were preserved; the revision contains only the evaluation gate, package script and focused regression extension.

## Expected result

Run the frozen P01–P16 case set and required safety mutations through a canonical gate. A valid fixture must pass all 30 positive cases and reject all 9 negative cases with zero deterministic safety failures and zero false-success results. A deliberately broken fixture must make the gate exit nonzero.

## Actual result

- `npm run check:receipt-pilot-evaluation` returned exit 0 with `validCases=30`, `validPassed=30`, `negativeCases=9`, `negativeRejected=9`, `deterministicSafetyFailures=0`, `falseSuccessCount=0` and evidence class `deterministic_fixture`.
- `npm run check:receipt-pilot-evaluation -- --broken` injected an external Receipt key into `P06-create-sg` and returned exit 1 with `receipt_pilot_evaluation_gate_failed:P06-create-sg`.
- The focused Vitest suite passes 1 file / 8 tests, including direct normal-gate and broken-fixture assertions.

The package script is [check:receipt-pilot-evaluation](../../../package.json); the gate is [evaluationGate.ts](../../../src/pilot/evaluationGate.ts). It is intentionally deterministic and does not call a provider or write a tenant database.

## Verification

| Command | Expected | Actual |
| --- | --- | --- |
| `npm run check:receipt-pilot-evaluation` | Gate passes with all positive/safety counts | Exit 0; 30/30 valid, 9/9 negative rejected |
| `npm run check:receipt-pilot-evaluation -- --broken` | Broken fixture fails the gate | Exit 1; `P06-create-sg` reported |
| `npx vitest run src/pilot/evaluationCases.test.ts --reporter=dot` | Gate and oracle regressions pass | 1 file, 8 tests passed |
| `npm run typecheck` | TypeScript succeeds | Passed |
| `npm run lint` | No lint errors or warnings | Passed |

## Acceptance boundary

This records the S2 deterministic failure-detection exit only. It does not claim live prompt-injection/tool runs, three model-scored runs, provider usage/cost, CI enforcement, rollout failure, emergency disable, production deployment, or business-owner acceptance. TASK-237 remains Todo and G10.2–G10.4 remain open.
