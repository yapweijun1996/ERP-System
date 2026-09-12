# TASK-205 — Source processing safety and readiness boundary

Date: 2026-09-13, Asia/Singapore. This record covers a local source/API
increment for TASK-205. It does not promote the task, a goal criterion or an
execution checkpoint to production acceptance.

## Selected gap and expected result

The remaining actionable repository gap was the boundary between document
processing source capability, configured provider metadata and evidence of a
live Vision service. The implementation must fail closed on malformed persisted
credential envelopes, avoid leaking provider details into job/outbox errors,
reject unsafe HTTP responses and redirects, preserve one tenant-bound
version/extraction chain for manual dead-letter retry, and expose a secret-free
readiness projection. It must not silently fall back from Vision to local OCR.

Expected:

- processing and outbox rows persist bounded application-owned errors;
- scanner, Local OCR and Vision HTTP drivers reject credentials/query/fragments,
  redirects, malformed JSON, invalid or oversized response bodies and preserve
  response cleanup;
- malformed encrypted-token envelopes prevent provider egress and optional or
  required connectors cannot become ready;
- `GET /api/integration/document-processing-readiness` derives the authenticated
  Master/Company scope and omits credential values and tenant identifiers;
- `POST /api/documents/:documentId/actions/retry-processing` checks the active
  tenant-bound document version, permission, idempotency and audit before
  requeueing the same processing chain.

## Observed result

The existing worktree implementation satisfies these local source/API cases.
The six-file focused regression passed 65 tests. The readiness projection keeps
local OCR source capability distinct from `configured-provider-unverified` and
never treats credential presence alone as provider health. HTTP 401/500 and
malformed-response paths remain failed/unavailable with no local-OCR fallback;
retry requeues the matching extraction row and outbox signal only after the
scoped, audited action. No schema, tenant, approval or Demo/PostgreSQL business
rule was changed.

## Verification and provenance

- Revision before this focused commit: root `main` at
  `367522dde96e1c4adf8e03f6530f46dbca2e4f53`; 70 pre-existing dirty
  worktree entries were preserved. The selected files were not mixed with the
  unrelated TASK-199/TASK-201/TASK-202/TASK-204 edits.
- Actor/environment: Codex, local macOS repository, PGlite/API fixtures,
  Asia/Singapore. No production database, external provider, credential, push
  or deployment was used.
- Focused regression: `npm test -- --run
  src/modules/documents/processing.test.ts
  src/modules/documents/processingDrivers.test.ts
  src/modules/documents/processingPolicyReadiness.test.ts
  src/modules/integration/connector.test.ts
  src/api/controlPlane.integration.test.ts
  src/api/documentGovernance.integration.test.ts` — **6 files / 65 tests
  passed**.
- `npm run lint` — pass, exit 0 with no warnings.
- `npm run typecheck` and `npm run typecheck:web` — pass, exit 0.
- `npm run demo` — pass, PGlite transaction/rollback/approval/stock/GL and
  concurrency assertions; no PostgreSQL target was configured.
- `npm run build:demo` — pass, exit 0. Existing Vite classic-script,
  browser-external/eval and chunk-size warnings remain non-fatal.
- `npm run docs:check` — pass, 85 Markdown files / 801 local links.
- Root Markdown/link/fragment review — pass, 3 files / 172 local links / 0
  missing.
- GOAL validator — pass: 227 done / 6 in progress / 4 todo / 3 blocked;
  31/48 criteria; 41/60 checkpoints; no dependency-ready Todo.
- `git diff --check` and conflict-marker search — pass; no conflict markers.

## Acceptance boundary

This is local source/PGlite/API evidence only. Production Vision gateway,
account, model, region, retention, live health, key rotation/revocation,
dead-letter alert delivery, operator recovery and owner acceptance remain open.
The exact source/test changes are staged separately from the mixed worktree so
unrelated user edits are not included.
