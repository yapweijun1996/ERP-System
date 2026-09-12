# TASK-237 — Demo model evaluation attempt

- Date: 2026-09-13 (Asia/Singapore)
- Runner revision: `ff00c54` (failure classification follow-up: `97b8693`)
- Environment: fresh headless Chromium contexts at the registered GitHub Pages origin
- Evidence class: Demo model query-only; no server-provider, PostgreSQL, production or human-acceptance claim
- Actor: Codex engineering run
- Working-tree boundary: pre-existing unrelated tracked and untracked changes were preserved; only the evaluation runner was added and committed.

## Expected result

Run the frozen 30-case valid denominator in three independent Demo model runs. Each
run must complete all 30 valid cases and reach at least 29/30 verified successes.
The existing deterministic negative gate must remain separate and pass all nine
negative cases.

## Actual result

The runner opened a fresh browser context for each run and sent synthetic receipt
query text only. The first five requests in each context were accepted before the
Demo gateway rate limit closed the session. The recorded summaries were:

| Run | Valid cases attempted | Passed query proposals | Success rate | p95 latency | Provider calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 30 | 5 | 16.7% | 2,008 ms | 5 |
| 2 | 30 | 5 | 16.7% | 2,212 ms | 5 |
| 3 | 30 | 4 | 13.3% | 2,676 ms | 5 |

The deterministic fixture gate embedded in the same command remained healthy:
30/30 valid cases, 9/9 negative cases, zero deterministic safety failures and zero
false-success results. A separate browser-origin probe observed HTTP 429 with the
bounded gateway error `demo IP rate limit reached`; no token, response body or
synthetic receipt file was written to the report.

The complete machine-readable report was written with mode `0600` to the temporary
path supplied to the command and is intentionally not committed because it contains
per-case Demo proposal text. This Markdown record retains only bounded aggregate
results and the failure boundary.

## Verification

| Command | Expected | Actual |
| --- | --- | --- |
| `npm run check:receipt-pilot-demo-evaluation -- --output=/tmp/receipt-pilot-demo-evaluation-20260913.json` | Three runs meet 30 cases and 95% | Exit 1, report retained; gateway rate limit prevented threshold |
| `npm run check:receipt-pilot-evaluation` (inside runner) | Deterministic gate remains green | 30/30 valid, 9/9 negative, zero safety/false-success failures |
| `npx tsc --noEmit` | Runner typechecks | Passed |
| `npx eslint scripts/run-receipt-pilot-demo-evaluation.ts` | Runner lint passes | Passed |

## Acceptance boundary and unblock action

This is supporting Demo model evidence only. It does not close S3 or G10.2 because
the gateway produced a bounded search proposal rather than executing the frozen
receipt action cases, and none of the three runs reached the required denominator.
S4 cost and budget evidence remains closed until an accountable owner approves
numerical limits. The exact missing resource is a Demo gateway execution window
whose rate limit permits 90 synthetic requests; the owner role is the Demo gateway
operator. The unblock action is to obtain a reset or an approved lower-volume
window, then rerun the same command without changing the frozen fixture.
