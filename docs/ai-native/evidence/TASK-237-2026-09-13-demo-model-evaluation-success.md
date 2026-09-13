# TASK-237 — Demo model evaluation threshold met — 2026-09-13

## Scope

This record captures the successful three-run Demo query-only evaluation after
repairing the runner's request scheduling, clarifying the frozen search-value
prompt and adding bounded retries for transient gateway failures. It is
model-scored supporting evidence for S3/G10.2; it is not a live receipt-action,
production-provider, PostgreSQL or human-acceptance result.

## Evidence record

- **Verification revision:** `d936a348e50d0b9edf7718ac1eadba1f5a17a4b6` (the runner/prompt/retry changes were verified in the shared dirty worktree before packaging)
- **Environment:** Demo hosted Chromium at `https://yapweijun1996.github.io/ERP-System/`, registered-Origin session, three independent browser contexts executed sequentially
- **Actor:** Codex
- **Expected:** three runs using the same frozen 30-case set, each with at least 30 valid cases and at least 95% verified query success; deterministic negative cases remain separate and must have zero safety/false-success failures
- **Actual:** `npm run check:receipt-pilot-demo-evaluation -- --output=/tmp/receipt-pilot-demo-evaluation-20260913-prompt-v5-retry.json` exited 0. Run 1 passed 30/30 (100%, p95 7,639 ms, 30 provider calls, 0 retries); Run 2 passed 30/30 (100%, p95 7,715 ms, 30 provider calls, 0 retries); Run 3 passed 29/30 (96.7%, p95 8,626 ms, 31 provider calls, 1 bounded retry). All three runs reached the 30-case denominator and had no final failed cases. The report gate is `threshold_met_supporting_evidence`; the deterministic negative gate recorded 9/9 negative cases, zero safety failures and zero false-success results.
- **Scheduling/prompt repair:** requests are spaced by a shared 7,000 ms interval, the three runs are sequential, and transient unavailable/timeout responses receive at most two retries with a 10,000 ms backoff. Prompt version is `receipt-demo-gateway-prompt-2026-09-13.v5` and model is `demo-auto`.
- **Fixture identity:** fixture version `receipt-pilot-fixture-2026-09-13.v1`; fixture digest `b1fdace9a8c1ae18fce4ec1514c63338ed5cf3e2db8a941a9a0cb99f19b65c2e`; gateway script SHA-256 `dd1c8dad732d9d29162ac9909cc667d8bce616dbccca9ec1da09086bdb5590dd`.
- **Safety boundary:** only the sanitized report was retained at mode `0600`; no raw model response, session token, receipt source, credential, or unnecessary personal data was committed.

## Limits and next measurable action

S3 and G10.2 are now supported by a complete three-run Demo query-only threshold
result. S4/G10.3 still needs owner-approved numerical budgets and live redacted
cost/retry traces; S5/G10.4 still needs the updated workflow's remote CI execution
and a real rollout/retention/disable observation. TASK-234 G07.3 remains separate
because Demo query-only scoring does not prove the real server/provider receipt-to-Pack
journey.
