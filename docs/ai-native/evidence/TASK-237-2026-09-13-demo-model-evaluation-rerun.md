# TASK-237 — Demo model evaluation rerun

- Date: 2026-09-13 (Asia/Singapore)
- Runner revision: `d936a348e50d0b9edf7718ac1eadba1f5a17a4b6`
- Environment: fresh headless Chromium contexts at the registered GitHub Pages origin
- Evidence class: Demo model query-only; no server-provider, PostgreSQL, production or human-acceptance claim
- Actor: Codex engineering run
- Working-tree boundary: existing dirty source/documentation paths were preserved; the machine-readable report stayed in a temporary `0600` file and is not committed.

## Expected result

Run the frozen 30-case valid denominator in three independent Demo model runs.
Each run must complete all 30 valid cases and reach at least 29/30 verified
successes. The deterministic negative gate must remain separate and pass all
nine negative cases.

## Actual result

The gateway session preflight returned HTTP `201` when the request carried the
registered Pages Origin. The three fresh browser contexts then completed all 30
case slots, but most proposal calls failed with the bounded
`demo_gateway_unavailable` result. No response body, token, receipt source or
provider credential was written to the report.

| Run | Valid cases | Passed proposals | Success rate | p95 latency | Gateway calls | Bounded error count |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 30 | 2 | 6.7% | 1,558 ms | 2 | 28 unavailable |
| 2 | 30 | 5 | 16.7% | 1,829 ms | 5 | 25 unavailable |
| 3 | 30 | 6 | 20.0% | 1,648 ms | 6 | 24 unavailable |

The deterministic gate embedded by the runner remained healthy: 30/30 valid
fixture cases, 9/9 negative cases, zero deterministic safety failures and zero
false-success results. The required 95% per-run threshold was not met.

## Verification

| Command | Expected | Actual |
| --- | --- | --- |
| `curl ... /demo/session` with registered Pages Origin | Demo session is available without exposing its body | HTTP 201; body discarded |
| `npm run check:receipt-pilot-demo-evaluation -- --output=/tmp/receipt-pilot-demo-evaluation-20260913-rerun.json` | Three runs meet 30 cases and 95% | Exit 1; all runs reached 30 slots but only 2/30, 5/30 and 6/30 proposals passed |
| Deterministic gate inside the runner | 30/30 valid, 9/9 negative, zero safety/false-success failures | Passed with those exact results |
| Temporary report permissions | No broad-readable evaluation artifact | `0600`, 25,678 bytes; not committed |

This rerun does not close S3 or G10.2. The missing resource is a stable Demo
gateway execution window whose response proposals remain available for all 90
synthetic requests; the owner role is the Demo gateway operator. The unblock
action is to repair or reset that gateway window, then rerun the unchanged
versioned command. Owner-approved numerical budgets and a real server-provider
journey remain separate gates.
