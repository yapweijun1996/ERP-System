# TASK-237 G10.3 acceptance evidence — fixture observability reports

- Date: 2026-09-13 (Asia/Singapore)
- Current revision: `b695a833ace3983149dd3728bbb1124fd010b250`
- Observability contract revision: `2d6193fc67d8042b53b1bb7f36dea23643dde5e4`
- Environment: local PGlite fixture runner; C-SG and C-MY; no external provider
- Evidence class: deterministic fixture and source-backed report validation
- Actor: Codex engineering run in the shared ERP-System worktree
- Working-tree boundary: unrelated tracked and untracked changes were preserved.

## Expected result

Record redacted run/model/tool versions, correlation IDs, approvals, resource
postconditions, latency and full retry cost, while rejecting secrets and
unnecessary sensitive payloads before persistence.

## Actual result

The canonical `scripts/receipt-assistant-pilot.ts --fixture` runner completed for
both Companies. Each successful `evidence.json` contains the versioned
`observability` report and persisted/reopened Receipt Pack and PDF checks. The
reports contain only `sha256:` correlation/resource identifiers and no raw
tenant IDs, credentials, receipt payloads or source paths.

| Company | Provider calls | Retries | Spent cost (micros) | Reserved cost (micros) | Full retry cost (micros) | p95 latency (ms) | Postconditions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C-SG | 5 | 0 | 280 | 280 | 280 | 234 | 2 receipts + Pack + artifact, all verified |
| C-MY | 5 | 0 | 280 | 280 | 280 | 255 | 2 receipts + Pack + artifact, all verified |

Both reports record:

- fixture/model/prompt/tool versions;
- redacted run, request, grant, approval, tool, database and artifact
  correlations;
- simulated approved confirmation state with a redacted reference;
- Receipt, Pack and artifact versions with verified postconditions;
- elapsed/provider/p95 latency, provider calls, retries, spent and reserved
  cost, observed concurrency and `fullRetryCostMicros`.

The report builder derives `fullRetryCostMicros` as
`max(spentCostMicros, reservedCostMicros)`. Focused adversarial tests also prove
that under-reported retry cost, unredacted identifiers and forbidden sensitive
field names are rejected. The operational budget gate remains pending because
no owner-approved numerical thresholds were invented.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npx tsx scripts/receipt-assistant-pilot.ts --fixture` | C-SG fixture completes and emits report | Exit 0; persisted/reopened Pack/PDF verified |
| `npx tsx scripts/receipt-assistant-pilot.ts --fixture --my` | C-MY fixture completes and emits report | Exit 0; persisted/reopened Pack/PDF verified |
| `npx vitest run src/pilot/evaluationObservability.test.ts src/pilot/receiptPilot.test.ts --reporter=dot` | Redaction, full-retry-cost and fixture persistence regressions pass | 2 files / 20 tests passed (19.21s) |
| `npm run check:receipt-pilot-evaluation` | Deterministic safety gate remains green | 30/30 valid, 9/9 negative, zero safety failures and zero false-success results |

The two runner stdout artifacts were retained only in mode-0600 temporary files;
their SHA-256 digests were
`d687305a7b2a8822bb3601a5290727dd4642356df199a6346c865aba268559a5` (C-SG) and
`b00917e90f871d330b97f32c275d8991c89f5faa314edfe960fdf959e4d28036` (C-MY).
The committed record contains no raw runner output.

## Boundary

This evidence accepts **G10.3** for the source/deterministic fixture boundary.
It does not accept TASK-237 as a whole, S4's owner-approved operational budget
gate, G10.4 production rollout/retention/disable observation, real-provider
Receipt OCR, or human acceptance. Demo, real-provider and production evidence
remain separate.
