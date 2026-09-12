# TASK-205 — Vision readiness boundary recheck — 2026-09-11

This record separates the implemented document-processing capability from the
production provider evidence still required by TASK-205. It uses synthetic data
and the already authorized Demo gateway protocol. It does not configure a
third-party account, change a Company policy, or claim production OCR.

## Identity and scope

- **Task / goal:** TASK-205 / G11 dependency for governed provider operations.
- **Dependencies:** Registry reports TASK-119 and TASK-194 as `done`; no
  dependency-ready Todo exists, and TASK-205's remaining production evidence is
  still an in-progress acceptance boundary.
- **Revision:** root `main` at `a4b7982bcf10ac71d709740af80dc2e79991e1c5`.
- **Worktree:** already dirty with unrelated changes; the connector source/test
  repair is also uncommitted in this worktree; no unrelated file was reverted
  or overwritten.
- **Actor / environment:** Codex; local source tests plus the hosted Demo
  protocol from the registered GitHub Pages origin. No provider credential was
  supplied or persisted.
- **Expected result:** verify that source failure/retry/revocation controls
  remain fail-closed, and explicitly classify Demo gateway/Codex review as
  protocol or synthetic evidence rather than a configured production Vision
  provider.
- **Actual result:** all 25 focused source tests passed. The connector health
  check now records configured `document-vision` as `warning` with
  `provider_health_unverified` and does not advance `lastSuccessAt`; this keeps
  configuration presence separate from live provider reachability. The Demo session and
  bounded response protocol returned the expected successful shapes (session
  201 and response 200 were previously recorded for this origin; this recheck
  observed a valid `dmo_*` session and `completed` response with two output
  items). The Demo contract returns a receipt-search proposal and does not
  receive receipt files, so it cannot close the document-Vision production
  gateway/account/region/retention or live-recovery gate.

## Checkpoint record

| Checkpoint | Actual output and files | Verification | Result |
| --- | --- | --- | --- |
| S1 | Read `docs/AI_PROVIDERS.md`, inherited TASK-205 procedure, `processing.ts`, `processingDrivers.ts`, connector policy and tests. | Current source and task registry agree that local capability is implemented while production provider evidence is open. | Pass |
| S2 | Direct HTTP-driver and worker tests cover HTTP failure, malformed/empty output, timeout, paused/revoked connector, bounded retry, dead letter and same-chain manual requeue. The connector regression proves configuration-only Vision checks do not claim live health. | `npm test -- --run src/modules/documents/processing.test.ts src/modules/documents/processingDrivers.test.ts src/modules/integration/connector.test.ts` — 3 files / 25 tests passed. | Pass |
| S3 | Demo gateway session and response protocol exercised with synthetic receipt-search text. | Valid `dmo_*` session token shape, `completed` response and two output items; token and response text were not recorded. | Pass |
| S4 | No production gateway/account/model/region/retention or live alert sink was available in the authorized scope. | Demo endpoint is a search-proposal protocol; source code sends document Vision only through deployment-owned `DOCUMENT_VISION_GATEWAY_URL`. | Blocked — production evidence unavailable |
| S5 | Dated record prepared and cross-linked from current status/progress/logic docs. | Documentation checks and KB readback recorded below. | Pass |

## Acceptance evidence

| TASK-205 acceptance | Evidence | Verdict |
| --- | --- | --- |
| Gateway timeout, provider 4xx/5xx, malformed response and revoked credential fail closed. | `processingDrivers.test.ts`, `processing.test.ts`, and `connector.test.ts` focused run above. | Pass for local source capability |
| Retry lease, idempotency and dead-letter/manual review preserve one document/version/extraction chain. | `processing.test.ts` same-chain retry and dead-letter/manual requeue cases. | Pass for local source capability |
| Manual retry versus policy-authorized local OCR fallback is explicit. | `processing.ts` retry boundary and test asserting local OCR is never called after Vision failure. | Pass for local source capability |
| Connector secrets are encrypted, non-disclosed and revocable. | `connector.test.ts` envelope, rotation, audit non-disclosure and pause/revocation cases. | Pass for local source capability |
| Production readiness distinguishes source capability from configured gateway, account, region, retention and health evidence. | Source health now reports configured `document-vision` as `warning` / `provider_health_unverified` without advancing `lastSuccessAt`; this record, `docs/AI_PROVIDERS.md`, and the Demo protocol result keep source/configuration/protocol evidence separate. No production gateway/account/health/recovery proof exists. | Source distinction pass; production evidence blocked |

## Demo and OCR boundary

The hosted Demo endpoint was used only for its documented browser assistant
protocol: it creates an ephemeral session and returns a bounded search proposal.
It does not accept receipt bytes and is not the worker's document OCR gateway.
Codex may visually review a synthetic receipt for Demo acceptance, but that
review does not create a third-party provider account, a retention guarantee, a
region guarantee, a production extraction record, or a live dead-letter alert.
The worker continues to fail closed when the selected Vision gateway is absent,
revoked or unavailable; it never silently falls back to local OCR.

One initial bare `urllib` probe was rejected with HTTP 403; it used the default
Python user agent and was not treated as product acceptance. A browser-shaped
request with the registered Origin and a browser user agent succeeded, matching
the documented browser-only CORS/session boundary.

## Commands actually executed

| Command | Environment | Result |
| --- | --- | --- |
| `npm test -- --run src/modules/documents/processing.test.ts src/modules/documents/processingDrivers.test.ts src/modules/integration/connector.test.ts` | Local PGlite fixtures, root `a4b7982` plus the connector health fix | Exit 0; 3 files / 25 tests passed. |
| `npm test -- --run src/api/controlPlane.integration.test.ts` | Local HTTP API with PGlite seed and synthetic encrypted envelope | Exit 0; 1 file / 2 tests passed, including the authenticated Vision health response. |
| `npm run lint` | Root dirty worktree | Pass; zero ESLint errors and warnings. |
| `npm run typecheck && npm run typecheck:web` | Root and bundled web TypeScript | Pass. |
| `npm run demo` | Local PGlite transaction proof | Pass; all checks passed. |
| `npm run build:demo` and `npm run check:demo-schema` | Bundled Demo and generated schema artifacts | Pass; Demo build completed and 112 ordered migrations matched. |
| Hosted Demo `/demo/session` then `/demo/v1/responses` with `Origin: https://yapweijun1996.github.io`, browser user agent, model `demo-auto`, synthetic `Find Cafe receipts` text | Hosted Demo protocol; no credential stored | Valid `dmo_*` session and `completed` response with 2 output items; response contents and token omitted. A bare Python user agent received 403 and was excluded from acceptance. |
| `git diff --check` | Root dirty worktree | Pass. |
| `npm run docs:check` | Root documentation | Pass: 79 Markdown files / 790 local links. |
| GOAL count validator and root Markdown review | Root registry and `GOAL.md` / `PROGRESS.md` / `GOAL_PROMPT.md` | Pass; 240 tasks, 14 pending, 27/48 criteria, 36/60 checkpoints, 83 local root links, no dependency-ready Todo. |

No production database, worker environment, connector secret, provider call,
alert sink, deployment, migration or external message was changed. The exact
production readiness gap is: an OCR operator/security owner must provide an
approved provider gateway/account/model, data region and retention policy, then
observe credential rotation/revocation and a real dead-letter alert with
controlled manual recovery. The accountable owner is the OCR operator together
with the security/operations owner.

## Progress and handoff

- Registry remains 240 total: 226 done, 6 in progress, 5 todo and 3 blocked;
  no status or acceptance count changed.
- AI workstreams remain 6/12, goal criteria 27/48 and execution checkpoints
  36/60. This source review is evidence classification, not a new capability
  count.
- `PROGRESS.md`, `docs/STATUS.md` and `docs/PROJECT_LOGIC.md` link this record;
  the main KB item was read back after the current TASK-205 connector-health update.
- Next measurable action: record the approved production provider scope and a
  real synthetic extraction plus controlled dead-letter recovery, without
  exposing credentials. Until then keep TASK-205 `in_progress`.

## Gateway URL egress guard — 2026-09-11T06:11:26Z

- **Expected result:** every deployment-owned scanner, local-OCR and BYOK Vision
  driver rejects an absolute HTTP(S) URL containing embedded credentials, query
  parameters or a fragment before any document request is constructed.
- **Implementation:** `src/modules/documents/processingDrivers.ts` now applies one
  `boundedUrl()` guard to all three constructors. The guard preserves the existing
  HTTP/HTTPS requirement and rejects `URL.username`, `URL.password`, `URL.search` and
  `URL.hash` with a stable, driver-specific error message.
- **Fixture evidence:** `src/modules/documents/processingDrivers.test.ts` uses
  synthetic credential/query/fragment URLs and asserts all three driver labels fail
  during construction; no fetch call can occur. Existing malformed output, HTTP
  failure, timeout and policy-header cases remain covered.
- **Actual verification:**
  `npm test -- --run src/modules/documents/processingDrivers.test.ts src/modules/documents/processing.test.ts`
  passed **2 files / 22 tests**. This is incremental source evidence; it does not
  replace or repeat the earlier 3-file / 25-test worker and connector evidence.
- **Environment / custody:** local Vitest fixture, root `main` at `a4b7982bcf10ac71d709740af80dc2e79991e1c5`, already-dirty worktree with unrelated changes; no provider URL, credential, receipt bytes or production request was used.
- **Acceptance delta:** source-level egress validation is stronger and documented in
  `docs/AI_PROVIDERS.md`, `docs/STATUS.md`, `docs/PROJECT_LOGIC.md` and
  `docs/TEST_COVERAGE.md`; registry status, goal criteria and execution checkpoint
  counts remain unchanged.
- **Remaining gate / owner / action:** the OCR operator with the security/operations
  owner must still provide an approved provider gateway/account/model, data region and
  retention policy, then observe rotation/revocation plus a real dead-letter alert and
  controlled manual recovery. No secret is requested or recorded here.

## Documentation and repository recheck — 2026-09-11T06:11:26Z

- `git diff --check` passed.
- The final common checks for this continuation are recorded below after lint,
  typechecks, Demo/build and documentation/count validators completed; no production
  deployment or external message is authorized by this evidence.

## Final source and parity gates — 2026-09-11T06:15:40Z

| Gate | Environment | Result |
| --- | --- | --- |
| `npm run lint` | Root dirty worktree | Pass; zero ESLint errors and warnings |
| `npm run typecheck && npm run typecheck:web` | Root and bundled web TypeScript | Pass |
| `env -u POSTGRES_URL npm run demo` | Local PGlite Demo transaction proof | Pass; all checks passed |
| `npm run build:demo` | Static Demo bundle | Pass; existing Vite warnings remain documented above |
| `npm run check:production-rls` | Generated PGlite/production policy review | Pass; 112 migrations/schema version 111, 231 policy tables, 10 infrastructure exemptions, 261 generated tables |
| `npm run check:drift` | Drizzle vs generated schema | Pass; 261 tables match |
| `npm run check:demo-pack` | Deterministic Demo showcase pack | Pass; pack v16 verified |
| `npm run check:i18n-bootstrap && npm run check:i18n-business` | Generated localization artifacts | Pass; 1798 English keys and 141 exact business values |
| `POSTGRES_URL='postgres://postgres@127.0.0.1:55432/postgres' npm run test:postgres` | Disposable PostgreSQL 16 container | Pass; 3 files / 3 tests |
| `npm run docs:check` | Root documentation | Pass; 79 Markdown files / 792 local links |
| Root Markdown local-link review | `GOAL.md`, `PROGRESS.md`, `GOAL_PROMPT.md` | Pass; 99 local links |
| GOAL count/dependency/fingerprint validator | Registry + GOAL projection | Pass; 226 done / 6 in progress / 5 todo / 3 blocked; 240 total; 27/48 criteria; 36/60 checkpoints; no dependency-ready Todo; registry SHA `82ffb4866fb95c917c97488981be94d8db8265775001fbbb7dccc24b042cc306` |
| `git diff --check` | Root dirty worktree | Pass |

The root remains on `main` at `a4b7982bcf10ac71d709740af80dc2e79991e1c5` with the
pre-existing dirty worktree preserved (219 changed/untracked paths before this
continuation's edits; no reset, commit, push, deployment, production migration or
external message). PostgreSQL evidence is disposable parity coverage, not production
readiness evidence.

## KB persistence recheck — 2026-09-11T06:20:00Z

- Added KB item `2a85b3de-117d-40a6-a73c-299e6f197983` to
  `erp-system-project-logic` with canonical key
  `erp-system:task-205:document-gateway-url-guard:2026-09-11`.
- `kb_get_item` readback confirms the source/test result, `production_verified=false`,
  `real_provider_verified=false`, evidence path and no secret-bearing fields.
- Retrieval event `116041` was rated helpful because it identified the applicable
  source boundary and retained the production blocker distinction.

## Bounded worker error persistence — 2026-09-11T06:27:07Z

- **Expected result:** scan and extraction retry/dead-letter records retain the
  retry/status behavior but never persist arbitrary scanner/provider exception text,
  URLs, credentials or response bodies in document jobs or processing outbox signals.
- **Root cause:** both worker catch paths previously wrote the raw `Error.message`
  (truncated to 1,000 characters) to `document_scan_job.last_error`,
  `document_extraction.last_error` and the corresponding `outbox_event.last_error`.
- **Implementation:** `processingErrorMessage()` now maps quarantine, timeout,
  unavailable, policy-requirement, indeterminate and invalid-output classes to stable
  application-owned messages and uses `Document processing failed.` for unknown errors.
  Raw text is still used only for in-memory status classification; persisted fields and
  `markSignalFailed()` receive the bounded message.
- **Fixture evidence:** `src/modules/documents/processing.test.ts` injects the same
  synthetic provider message containing fixture credentials, URL and query data into
  scanner and local-OCR failures. Both document job records and both processing
  outbox signals contain only `Document processing failed.` and the serialized rows do
  not contain the synthetic secret marker.
- **Actual verification:**
  `npm test -- --run src/modules/documents/processing.test.ts src/modules/documents/processingDrivers.test.ts`
  passed **2 files / 23 tests**. The first attempt exposed an unisolated queued retry
  in the test fixture; setting that fixture's `maxAttempts: 1` made the test faithfully
  exercise the terminal path, after which the rerun passed. No production code retry
  was repeated unchanged.
- **Scope / custody:** local Vitest fixtures, tenant-scoped DB transactions and the
  existing Demo/PostgreSQL contracts; no provider credential, receipt bytes, production
  request or external message was used. TASK-205 remains `in_progress`; production
  gateway/account/region/retention and live alert/recovery evidence remain open.

## Error-persistence final gate recheck — 2026-09-11T06:29:20Z

| Gate | Environment | Result |
| --- | --- | --- |
| `npm run lint` | Root dirty worktree | Pass; zero ESLint errors and warnings |
| `npm run typecheck && npm run typecheck:web` | Root and bundled web TypeScript | Pass |
| `env -u POSTGRES_URL npm run demo` | Local PGlite Demo transaction proof | Pass; all checks passed |
| `npm run build:demo` | Static Demo bundle | Pass; existing classic-script, missing-CSS, PGlite externalization/eval and large-chunk warnings remain unchanged |
| `npm run check:production-rls && npm run check:drift && npm run check:demo-pack && npm run check:i18n-bootstrap && npm run check:i18n-business` | Generated schema, RLS, pack and localization artifacts | Pass; 112 migrations/schema version 111, 261 tables, pack v16, 1798 English keys and 141 exact business values |
| `POSTGRES_URL='postgres://postgres@127.0.0.1:55432/postgres' npm run test:postgres` | Disposable PostgreSQL 16 container | Pass; 3 files / 3 tests |
| `npm run docs:check` | Root documentation | Pass; 79 Markdown files / 792 local links |
| Root Markdown local-link review | `GOAL.md`, `PROGRESS.md`, `GOAL_PROMPT.md` | Pass; 99 local links |
| GOAL count/dependency/fingerprint validator | Registry + GOAL projection | Pass; 226 done / 6 in progress / 5 todo / 3 blocked; 240 total; 27/48 criteria; 36/60 checkpoints; no dependency-ready Todo; registry SHA `82ffb4866fb95c917c97488981be94d8db8265775001fbbb7dccc24b042cc306` |
| `git diff --check` | Root dirty worktree | Pass |

The root remains `main` at `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; all pre-existing
worktree changes remain uncommitted and no production deployment, migration, provider
request or external message was made. PostgreSQL and Demo results are parity evidence,
not live provider or production operations acceptance.

## KB persistence readback — 2026-09-11T06:35:00Z

- Added KB item `23e5ba02-1e30-46d7-856b-a36626196dbf` to
  `erp-system-project-logic` with canonical key
  `erp-system:task-205:bounded-worker-error-persistence:2026-09-11`.
- `kb_get_item` readback confirms the source/test summary, evidence path,
  `production_verified=false`, `real_provider_verified=false`, and no secret-bearing
  fields. The item is explicitly scoped to local source/Demo/PostgreSQL evidence.
- Final custody check reports 222 changed/untracked paths on `main`; unrelated
  worktree changes remain preserved and no reset, commit, push, deployment,
  production request or external message was made.

## HTTP redirect fail-closed guard — 2026-09-11T06:50:46Z

- **Expected result:** the scanner, local-OCR and BYOK Vision HTTP drivers must
  refuse HTTP redirects so document bytes and provider authorization cannot be
  forwarded to an unapproved host.
- **Root cause:** the three driver calls used the platform `fetch` default redirect
  policy. A 3xx response could therefore change the request destination before the
  application classified the response.
- **Implementation:** `src/modules/documents/processingDrivers.ts` now passes
  `redirect: 'error'` in all three POST request options. Existing absolute
  HTTP(S), credential/query/fragment URL validation, policy headers, timeout,
  retry and Demo/PGlite/PostgreSQL contracts remain unchanged.
- **Fixture evidence:** `src/modules/documents/processingDrivers.test.ts` runs a
  table-driven synthetic scanner/local-OCR/BYOK-Vision case and asserts the option
  reaches `fetch`; the mocked 302 is classified as `HTTP 302` and no redirected
  second request is allowed by the driver contract.
- **Actual verification:** `npm test -- --run
  src/modules/documents/processingDrivers.test.ts
  src/modules/documents/processing.test.ts --reporter=dot` passed **2 files /
  26 tests**. This mock proves option propagation and application classification;
  it is not a live network redirect or provider test.
- **Parity and gates:** lint, root/web typechecks, local PGlite Demo, Demo build,
  generated schema/RLS/drift/pack/i18n checks, and disposable PostgreSQL 16
  `test:postgres` passed. Demo and PostgreSQL results are parity evidence only.
- **Custody:** Codex actor; root `main` at `a4b7982bcf10ac71d709740af80dc2e79991e1c5`;
  the worktree already contained unrelated changes and remains uncommitted. No
  provider credential, receipt bytes, deployment, production request or external
  message was used.
- **Acceptance delta:** source-level redirect egress is now fail-closed and
  recorded in `docs/AI_PROVIDERS.md`, `docs/STATUS.md`,
  `docs/PROJECT_LOGIC.md` and `docs/TEST_COVERAGE.md`; TASK-205 status and
  GOAL counts remain unchanged.
- **Remaining gate / owner / action:** the OCR operator with the security/
  operations owner must still provide approved gateway/account/model, region and
  retention policy, then observe rotation/revocation plus a real dead-letter alert
  and controlled manual recovery without exposing credentials.

## Documentation and KB persistence recheck — 2026-09-11T06:56:00Z

- `npm run docs:check` passed: 79 Markdown files / 792 local links.
- Root Markdown link/fragment review passed: `GOAL.md`, `PROGRESS.md` and
  `GOAL_PROMPT.md`, 102 local links.
- The GOAL count/dependency validator passed: 240 tasks; 226 done, 6 in
  progress, 5 todo and 3 blocked; 27/48 criteria; 36/60 checkpoints; no
  dependency-ready Todo. The registry fingerprint is
  `360d466f91d41412fbe5d1c10989658390afee43897e6a96672a0d26c9a9440a`.
- `git diff --check` passed. The root remains `main` at
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5` with the pre-existing dirty
  worktree preserved; no reset, commit, push, deployment, production mutation
  or external message was made.
- KB item `c31b37b6-ef5b-4485-9fd6-2201d40f9713` was added to
  `erp-system-project-logic` under canonical key
  `erp-system:task-205:document-driver-redirect-guard:2026-09-11` and read back.
  Its metadata records `production_verified=false`,
  `real_provider_verified=false`, the evidence anchor, local/Demo/PostgreSQL
  scope and `no_secrets=true`.

## Response body size boundary — 2026-09-11T07:03:08Z

- **Expected result:** successful scanner, local-OCR and BYOK Vision responses must
  be bounded before JSON parsing, even when the upstream omits `Content-Length`.
- **Root cause:** `response.json()` previously buffered the entire successful
  response before the existing 5,000,000-character extraction check. That left a
  larger-than-expected JSON envelope able to consume worker memory first.
- **Implementation:** `processingDrivers.ts` now reads successful response streams
  with a shared 8 MiB cap, rejects an advertised `Content-Length` above the cap,
  cancels an over-limit stream and only then decodes/JSON-parses the bounded bytes.
  HTTP error responses retain the existing status-first failure path.
- **Fixture evidence:** `processingDrivers.test.ts` sends a synthetic successful
  response through a stream with no `Content-Length` and an 8 MiB plus one-byte
  chunk; the driver rejects it before provider output parsing.
- **Actual verification:** `npm test -- --run
  src/modules/documents/processingDrivers.test.ts
  src/modules/documents/processing.test.ts --reporter=dot` passed **2 files /
  28 tests**. Existing URL, redirect, HTTP failure, malformed output, timeout,
  policy-header, retry and bounded-persistence cases remain green.
- **Parity and gates:** lint, root/web typechecks, local PGlite Demo, Demo build,
  generated schema/RLS/drift/pack/i18n checks and disposable PostgreSQL 16
  `test:postgres` passed. These are local or disposable parity results, not live
  provider or production evidence.
- **Custody:** Codex actor; root `main` at `a4b7982bcf10ac71d709740af80dc2e79991e1c5`;
  existing dirty paths were preserved. No provider credential, receipt bytes,
  deployment, production request or external message was used.
- **Acceptance delta:** TASK-205 now has a bounded successful-response memory
  boundary in addition to URL/redirect and persisted-error safeguards. Registry
  status and GOAL counts remain unchanged.
- **Remaining gate / owner / action:** OCR operator and security/operations owner
  still need to approve gateway/account/model, region and retention, then observe
  real extraction, rotation/revocation, alert delivery and controlled manual
  recovery without exposing credentials.

## Response-boundary documentation and KB recheck — 2026-09-11T07:05:00Z

- `npm run docs:check` passed: 79 Markdown files / 792 local links.
- Root Markdown link/fragment review passed for `GOAL.md`, `PROGRESS.md` and
  `GOAL_PROMPT.md`: 103 local links.
- The GOAL count/dependency validator passed: 240 tasks; 226 done, 6 in
  progress, 5 todo and 3 blocked; 27/48 criteria; 36/60 checkpoints; no
  dependency-ready Todo. Registry fingerprint:
  `26eae6290d79cd288f101628bba5da4c3693f00c54cc60235ee46dbffe112272`.
- `git diff --check` passed. Root `main` remains at
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; existing dirty paths remain
  preserved, with no reset, commit, push, deployment, production mutation or
  external message.
- KB item `d69cded8-8ca1-4cd4-ac7e-2729c4187987` was added to
  `erp-system-project-logic` under canonical key
  `erp-system:task-205:document-driver-response-body-boundary:2026-09-11` and
  read back. Metadata records `production_verified=false`,
  `real_provider_verified=false`, the evidence anchor, local/Demo/PostgreSQL
  scope and `no_secrets=true`.

## Common gate recheck after response-boundary implementation — 2026-09-11T07:12:37Z

- `npm run build:demo` passed. Existing Vite warnings about classic scripts, missing
  runtime CSS, PGlite browser externalization/eval and large chunks remain baseline
  warnings; no build error occurred.
- `npm run check:production-rls`, `npm run check:drift`, `npm run check:demo-pack`,
  `npm run check:i18n-bootstrap` and `npm run check:i18n-business` passed. The
  generated schema/RLS, 261-table drift, Demo pack v16 and 1798/141 i18n checks
  remain aligned.
- `env -u POSTGRES_URL npm run demo` passed all PGlite parity/concurrency checks,
  and the disposable PostgreSQL 16 target passed `npm run test:postgres` with
  3 files / 3 tests.
- These rechecks remain local/Demo/disposable-PostgreSQL evidence. No provider
  credential, receipt bytes, production request, deployment or external message
  was used; real-provider configuration, operational rotation/revocation and
  live dead-letter alert/manual recovery remain open.

## Static and focused regression recheck — 2026-09-11T07:13:53Z

- `npm run lint`, `npm run typecheck` and `npm run typecheck:web` passed with zero
  reported errors.
- The affected regression command passed 2 files / 28 tests, including the
  no-`Content-Length` streaming over-limit fixture and the advertised-length
  pre-read rejection fixture.
- The full repository `npm test` baseline remains the earlier recorded 208 files /
  921 tests; it was not rerun for this bounded driver slice.

## Failed response-body cleanup — 2026-09-11T07:22:43Z

- **Expected result:** scanner, local-OCR and BYOK Vision HTTP failures must return
  the fixed status error without retaining an unconsumed response stream.
- **Root cause:** `responseJson()` classified non-2xx responses immediately and did
  not cancel their bodies. A failed provider response could therefore leave stream
  or connection resources open until the runtime reclaimed them.
- **Implementation:** the shared `responseJson()` helper now cancels a failed
  response body, swallowing cancellation cleanup errors, before returning the
  bounded application-owned `HTTP <status>` error. All three document drivers use
  this helper, so the policy remains shared across scanner, local OCR and BYOK Vision.
- **Fixture evidence:** `processingDrivers.test.ts` uses a synthetic streamed HTTP
  500 response and asserts that its body `cancel()` callback runs exactly once while
  the caller receives the fixed HTTP status error. No provider credential or receipt
  bytes are involved.
- **Actual verification:** the focused command
  `npm test -- --run src/modules/documents/processingDrivers.test.ts
  src/modules/documents/processing.test.ts --reporter=dot` passed **2 files /
  29 tests**. Lint, root/web typechecks, Demo build, generated RLS/drift/pack/i18n
  checks, PGlite Demo and disposable PostgreSQL 16 `test:postgres` (3/3) also passed.
- **Custody:** Codex actor; root `main` remains at
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5` with pre-existing dirty paths
  preserved. No reset, commit, push, deployment, production request, provider
  credential, receipt bytes or external message was used.
- **Acceptance delta:** TASK-205 source resource cleanup now accompanies the URL,
  redirect, bounded-success-response and bounded-error-persistence safeguards.
  Registry status and GOAL counts remain unchanged.
- **Remaining gate / owner / action:** OCR operator and security/operations owner
  still need an approved gateway/account/model, region and retention policy, then a
  real extraction plus rotation/revocation, delivered dead-letter alert and
  controlled manual recovery. Local/Demo/disposable-PostgreSQL evidence does not
  satisfy those production gates.

## Final documentation, registry and KB recheck — 2026-09-11T07:24:45Z

- `npm run docs:check` passed: 79 Markdown files / 792 local links. The root
  `GOAL.md`, `PROGRESS.md` and `GOAL_PROMPT.md` link/fragment review passed with
  104 local links, and `git diff --check` passed.
- The GOAL count/dependency validator passed: 240 tasks; 226 done, 6 in progress,
  5 todo and 3 blocked; 27/48 criteria; 36/60 checkpoints; no dependency-ready
  Todo. The refreshed registry fingerprint is
  `1d09fef3fc744846d72f7d5d946fc3cef8d420932f7c11e36116bbba280d98dd`.
- KB item `d69cded8-8ca1-4cd4-ac7e-2729c4187987` was updated and read back in
  `erp-system-project-logic`; its content records the 29-test failed-body cleanup
  evidence and its metadata points to this anchor with
  `production_verified=false`, `real_provider_verified=false` and
  `no_secrets=true`.
- Root custody remains `main` at `a4b7982bcf10ac71d709740af80dc2e79991e1c5`
  with 222 pre-existing or task-local dirty paths preserved. No reset, commit,
  push, deployment, production mutation or external message was made.

## Authenticated dead-letter retry action — 2026-09-11T07:57:58Z

- **Expected result:** an authorized operator must be able to manually recover a
  terminal document-processing job through the authenticated API without creating a
  new document/version/extraction chain; an unauthorized actor, guessed version or
  tenant override must fail closed.
- **Root cause:** `retryDocumentProcessing` was a tenant-scoped transactional
  command covered by module tests, but no authenticated document action exposed the
  operator boundary. Recovery therefore had no API permission, idempotency or audit
  contract.
- **Implementation:** `retryDocumentProcessingWithin` now contains the reusable
  transaction-local command; the existing wrapper preserves its direct API. The
  `POST /api/documents/:documentId/actions/retry-processing` action validates a
  positive `versionId` belonging to the path document and active session tenant,
  requires `documents.governance.manage`, and runs through `dispatchAction` for
  tenant context, required idempotency and append-only audit.
- **Fixture evidence:** the API/PGlite integration creates a clean scan plus a
  dead-letter extraction and signal, proves viewer denial, guessed-version 404,
  tenant-field tamper rejection, successful same-chain requeue, audit attribution,
  idempotent replay and changed-payload conflict. It uses synthetic rows only; no
  provider credential, receipt bytes or external endpoint is used.
- **Actual verification:**
  `npm test -- --run src/api/documentGovernance.integration.test.ts
  src/modules/documents/processing.test.ts --reporter=dot` passed **2 files /
  14 tests**. `npm run lint`, root/Web typechecks, Demo build, generated
  schema/RLS/drift/pack/i18n checks, PGlite Demo and disposable PostgreSQL 16
  `test:postgres` (3/3) passed. The full `npm test -- --reporter=dot` passed
  **208 files / 932 tests**, with 3 skipped files/tests, in 1520.84 seconds.
- **Custody:** Codex actor; root `main` remains at
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5` with 222 dirty paths preserved.
  No reset, commit, push, deployment, production write, provider credential,
  alert destination or external message was used.
- **Acceptance delta:** TASK-205 now has an authenticated, tenant/version-bound
  and audited manual-recovery API boundary in addition to the shared driver and
  worker safeguards. Registry status and GOAL counts remain unchanged.
- **Remaining gate / owner / action:** the OCR/security/operations owners still
  need to approve the production gateway/account/model/region/retention, deliver a
  real extraction, exercise key rotation/revocation and observe a real dead-letter
  alert with named responder and controlled recovery. Local/API recovery does not
  satisfy those production gates.

## Final registry, documentation and custody recheck — 2026-09-11T08:00:08Z

- The GOAL count/dependency/fingerprint validator passed: 240 tasks; 226 done, 6
  in progress, 5 todo and 3 blocked; 27/48 criteria; 36/60 checkpoints; no
  dependency-ready Todo. The registry fingerprint is
  `dcf8154b1ebedb83a92868a08b4018587a7ea00776c429c1d2c121f7fc0c43d7`.
- `npm run docs:check` passed with 79 Markdown files / 792 local links. The root
  `GOAL.md`, `PROGRESS.md` and `GOAL_PROMPT.md` link/fragment review passed with
  105 local links; `git diff --check` passed.
- KB item `d69cded8-8ca1-4cd4-ac7e-2729c4187987` was updated and read back in
  `erp-system-project-logic`; content records the authenticated retry action and
  932-test full regression. Metadata points to the retry-action anchor with
  `production_verified=false`, `real_provider_verified=false` and
  `no_secrets=true`.
- Root custody is `main` at `a4b7982bcf10ac71d709740af80dc2e79991e1c5`, with
  224 dirty paths and 7 worktrees preserved. No reset, commit, push, deployment,
  production mutation, provider credential, alert destination or external message
  was used.

## Source-configured provider readiness projection — 2026-09-11

- **Expected result:** expose a tenant-scoped, secret-free readiness read that
  distinguishes implemented local OCR/BYOK source capability from Company policy,
  connector configuration and verified external-provider health. A stored or
  encrypted credential alone must not become provider-ready evidence.
- **Implementation:** `getDocumentProcessingReadinessWithin` reads only the active
  `masterFn` + `companyFn`, and the authenticated
  `GET /api/integration/document-processing-readiness` route requires
  `integrationRead`. The response reports safe connector metadata, policy fields,
  `credentialConfigured`, bounded reason codes and one of
  `local-ocr-source-capability`, `configured-provider-unverified` or
  `provider-health-verified`; encrypted credential envelopes are never returned.
- **Fixture evidence:** local PGlite tests cover the default local-OCR path, a
  configured Vision connector whose health remains `warning` /
  `provider_health_unverified`, credential non-disclosure and a C-SG/C-MY tenant
  isolation read. The authenticated control-plane test covers the initial and
  credential-only readiness API responses.
- **Actual verification:**
  `npm test -- --run src/modules/documents/processingPolicyReadiness.test.ts
  src/api/controlPlane.integration.test.ts --reporter=dot` passed **2 files / 5
  tests**. Root lint, both TypeScript checks, local Demo, Demo build, disposable
  PostgreSQL 16 `test:postgres` (3/3), production RLS, schema drift, docs and the
  GOAL count/dependency/fingerprint validator also passed; `git diff --check`
  passed. No schema or generated artifact changed.
- **Custody:** Codex actor; root `main` remains at
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5` with the pre-existing dirty worktree
  preserved (226 paths observed after this source/test addition). No provider
  account, secret, production request, alert delivery, migration, deployment,
  commit, push or external message was used.
- **Acceptance delta:** TASK-205 now has an explicit source/configuration/live
  health projection that can be consumed by operators without treating Demo/Codex
  OCR review or credential presence as production provider proof. Registry status,
  GOAL criteria and execution checkpoint counts remain unchanged.
- **Remaining gate / owner / action:** the OCR operator with the security/
  operations owner still must approve a real gateway/account/model, data region and
  retention policy, then observe live health, rotation/revocation, a delivered
  dead-letter alert and controlled recovery. The local/Demo/PostgreSQL evidence in
  this record does not satisfy those production gates.

## Full regression recheck — 2026-09-11T08:56:26Z

- `npm test -- --reporter=dot` passed **209 files / 943 tests**, with 3 skipped
  files/tests (212 files / 946 tests total), in 1330.15 seconds after the readiness
  route, projection and focused regressions were added.
- The expected malformed-JSON and locale-failure stderr lines were produced by
  tests that assert bounded error handling; Vitest exited 0. No provider account,
  credential, production request, alert delivery or external message was used.
- This supersedes the earlier 208-file / 940-test local regression line for the
  current dirty worktree. It does not alter TASK-205 status, GOAL criteria or
  execution checkpoint counts, and it remains local source/Demo/PostgreSQL parity
  evidence rather than production provider acceptance.

## Cross-Master readiness isolation regression — 2026-09-11T09:37:44Z

- Actor and provenance: Codex; root worktree `main` at HEAD `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; `git status --short` reports 226 dirty paths, and unrelated changes plus the TASK-236 candidate worktree remain preserved.
- Expected result: after configuring a Vision connector for `M1/C-SG`, a readiness read for the same company key under foreign Master `M2` must use the local-OCR default and must not expose the configured endpoint or encrypted credential.
- Actual result: `src/modules/documents/processingPolicyReadiness.test.ts` now asserts the foreign-Master projection returns `local_ocr`, `connectorStatus: 'missing'`, `externalProviderReady: false` and no SG endpoint or fixture secret. The existing query remains scoped by both `masterFn` and `companyFn`; no production logic or schema changed.
- Verification: `npm test -- --run src/modules/documents/processingPolicyReadiness.test.ts --reporter=dot` passes 1 file / 3 tests; `npm test -- --run src/api/controlPlane.integration.test.ts --reporter=dot` passes 1 file / 2 tests; `npm run lint`, `npm run typecheck` and `npm run typecheck:web` pass. This is source/PGlite/API evidence only; Demo-build and disposable PostgreSQL gates were not repeated for a test-only assertion.
- Scope and remaining evidence: no provider credential, real extraction, production request, alert delivery, deployment, push, migration or secret was used. Production gateway/account/region/retention, live rotation/revocation, dead-letter alert/recovery and owner acceptance remain open; no registry count, GOAL criterion, execution checkpoint or task status is promoted.

## HTTP readiness scope tamper regression — 2026-09-11T09:42:24Z

- Actor and provenance: Codex; root worktree `main` at HEAD `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; `git status --short` reports 226 dirty paths, with unrelated changes and the TASK-236 candidate worktree preserved.
- Expected result: the authenticated readiness API must derive `masterFn` and `companyFn` from the session; client-supplied tenant query parameters must not redirect the read or expose another tenant's readiness, endpoint or credential metadata.
- Actual result: `GET /api/integration/document-processing-readiness?masterFn=M2&companyFn=C-MY` returns the exact same session-scoped response as the untampered request, and the response contains neither supplied foreign identifier. The route remains source-scoped and no production logic or schema changed.
- Verification: `npm test -- --run src/api/controlPlane.integration.test.ts --reporter=dot` passes 1 file / 2 tests; the readiness module passes 1 file / 3 tests; `npm run lint`, `npm run typecheck` and `npm run typecheck:web` pass. Demo-build, disposable PostgreSQL, deployment and provider gates were not repeated for this test-only assertion.
- Scope and remaining evidence: no provider credential, real extraction, production request, alert delivery, deployment, push, migration or secret was used. Production gateway/account/region/retention, live rotation/revocation, dead-letter alert/recovery and owner acceptance remain open; no registry count, GOAL criterion, execution checkpoint or task status is promoted.

## Readiness invalidation after connector pause — 2026-09-11T09:49:12Z

- Actor and provenance: Codex; root worktree `main` at HEAD `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; `git status --short` reports 226 dirty paths, with unrelated changes and the TASK-236 candidate worktree preserved.
- Expected result: a readiness projection that previously observed connected, healthy provider evidence must become unverified when the connector is paused, even if `lastSuccessAt` remains as historical evidence. Stale health must never override the current enabled/status boundary.
- Actual result: the regression seeds a connected Vision connector with a bounded historical `lastSuccessAt`, confirms `provider-health-verified`, pauses it through `setConnectorEnabledWithin`, then confirms `connectorStatus: 'paused'`, `connectorEnabled: false`, `externalProviderReady: false`, class `configured-provider-unverified` and `provider_connector_not_connected`. The historical timestamp remains observable as metadata but cannot promote readiness.
- Verification: `npm test -- --run src/modules/documents/processingPolicyReadiness.test.ts --reporter=dot` passes 1 file / 4 tests; `npm test -- --run src/modules/integration/connector.test.ts --reporter=dot` passes 1 file / 6 tests; the control-plane API regression passes 1 file / 2 tests; `npm run lint`, `npm run typecheck` and `npm run typecheck:web` pass. Demo-build and disposable PostgreSQL gates were not repeated for this source/PGlite test-only change.
- Scope and remaining evidence: no provider credential, real extraction, production request, alert delivery, deployment, push, migration or secret was used. Production gateway/account/region/retention, live rotation/revocation, dead-letter alert/recovery and owner acceptance remain open; no registry count, GOAL criterion, execution checkpoint or task status is promoted.

## Demo parity gate after readiness regression — 2026-09-11T09:53:23Z

- Actor and provenance: Codex; root worktree `main` at HEAD `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; `git status --short` remains 226 dirty paths and unrelated changes plus the TASK-236 candidate worktree are preserved.
- Expected result: the test-only readiness/connector regression must leave the shared Demo/PGlite transaction contract and static Demo build healthy, without adding a Demo-only rule or generated schema change.
- Actual result: `npm run demo` completed all PGlite transaction, rollback, approval, stock/GL balance and concurrency assertions; `npm run build:demo` completed the TypeScript build and Vite production bundle with exit code 0. Existing Vite warnings about classic scripts, externalized Node modules and chunk size remained non-fatal; no generated schema or migration changed.
- Scope and remaining evidence: this is local PGlite/Demo parity evidence only. No provider credential, receipt bytes, real extraction, production request, deployment, alert delivery, push, migration or secret was used; production gateway/account/region/retention, live rotation/revocation, dead-letter alert/recovery and owner acceptance remain open. No registry count, GOAL criterion, execution checkpoint or task status is promoted.

## HTTP Vision driver-to-worker failure boundary — 2026-09-11T10:14:59Z

- **Actor / state:** Codex added a cross-layer regression in
  `src/modules/documents/processing.test.ts` from root `main` at
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the 226-entry dirty worktree and
  separate TASK-236 candidate worktree were preserved.
- **Expected:** an actual HTTP Vision driver response with status 401 or 500 must
  fail closed through the worker transaction. It must leave the extraction unsafe,
  persist only the bounded application-owned error and never call local OCR.
- **Actual:** both parameterized cases returned `scansClaimed=1`, `clean=1`,
  `extractionsClaimed=1`, `extracted=0`, `failed=1`; the extraction remained
  `provider=byok_vision`, `status=failed`, `rawText=null` and
  `lastError='Document processing failed.'`. The mocked upstream body contained a
  URL/token marker, but no such detail was persisted; local OCR was not called.
- **Verification:** the focused processing/driver suite passed 2 files / 31 tests;
  root lint, root and Web typechecks, `npm run demo` and serial `npm run build:demo`
  also passed. Build warnings remain the known classic-script, externalized Node
  module, missing-static-asset and chunk-size warnings. This test-only boundary
  change did not require a new schema or migration; the disposable PostgreSQL
  baseline remains separately recorded rather than repeated.
- **Acceptance delta / boundary:** TASK-205 now has direct source evidence that
  non-success HTTP Vision responses cannot become clean or safe extraction through
  the worker integration. No provider credential, production request, alert sink,
  deployment, push or real-provider acceptance was used. Production gateway,
  account, region, retention, rotation/revocation, alert/recovery and owner gates
  remain open; registry, GOAL criteria and checkpoint counts are unchanged.
- **Documentation gates after this record:** `npm run docs:check` passed 79 Markdown
  files / 792 local links; the exact GOAL count/dependency/fingerprint validator
  passed with 240 tasks (226 done, 6 in progress, 5 todo, 3 blocked), 27/48
  criteria, 36/60 checkpoints and no dependency-ready Todo; root Markdown
  link/fragment review passed 116 local links and `git diff --check` passed.

## HTTP Vision visual-fingerprint propagation — 2026-09-11T10:45:42Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the existing 226-entry dirty
  worktree and separate TASK-236 candidate worktree were preserved. The source
  change uses synthetic provider JSON and the existing local PGlite worker; no
  provider credential, receipt bytes, production request, deployment, push,
  migration or external message was used.
- **Expected:** A configured HTTP Vision provider's optional visual fingerprint
  must cross the driver boundary unchanged in meaning, be normalized and checked
  as a 64-character hexadecimal value, and reach the versioned extraction record.
  The system must never derive a visual fingerprint from OCR text. Missing
  provider fingerprint remains allowed for providers that do not supply one.
- **Root cause:** `src/modules/documents/processing.ts` already accepted and
  persisted `ExtractionResult.visualFingerprint`, but
  `src/modules/documents/processingDrivers.ts` returned only raw text, model,
  safety and fields from HTTP JSON. A valid provider fingerprint was therefore
  silently discarded before the worker could persist it.
- **Implementation:** The shared HTTP extraction parser now accepts an optional
  string fingerprint, trims and lowercases it, requires exactly 64 hexadecimal
  characters and rejects invalid types or formats with a bounded application-owned
  error. The normalized value is returned to the worker; no hash is computed from
  `rawText`.
- **Actual:** `processingDrivers.test.ts` proves uppercase/whitespace provider
  output becomes the normalized value, missing output remains valid, and invalid
  string/number values fail closed. `processing.test.ts` exercises the actual
  `createHttpByokVisionExtractor` through the worker and verifies the normalized
  fingerprint is persisted on the `byok_vision` extraction with its model and
  succeeded state.
- **Verification:**
  `npm test -- --run src/modules/documents/processingDrivers.test.ts
  src/modules/documents/processing.test.ts --reporter=dot` passes **2 files / 37
  tests**. `npm run lint`, `npm run typecheck`, `npm run typecheck:web`,
  `npm run demo` and `npm run build:demo` pass. The build retains existing
  classic-script, externalized Node module, PGlite `eval` and chunk-size warnings.
  No UI surface changed, so the receipt browser E2E was not repeated for this
  backend-only change; its prior desktop/375px evidence remains separately
  recorded.
- **Acceptance delta / boundary:** TASK-205 source capability now preserves
  provider visual provenance through the HTTP worker boundary while retaining
  fail-closed validation. Registry status, GOAL criteria and execution checkpoint
  counts remain unchanged. This is local source/PGlite/Demo parity evidence only;
  production gateway/account/model/region/retention, live credential
  rotation/revocation, delivered dead-letter alert/recovery and owner acceptance
  remain open. The OCR operator plus security/operations owner must still approve
  the provider scope and record a real extraction and controlled recovery outcome.
- **Documentation / persistence:** `npm run docs:check` passed 79 Markdown files
  and 795 local links; the exact GOAL count/dependency/fingerprint validator passed
  with registry SHA-256
  `ae1d386b9e6eae21066f47bccb7ab3ae3f17a066ff7dd4eceaf97684ec2f4c43`, 240 tasks
  (226 done, 6 in progress, 5 todo, 3 blocked), 27/48 criteria, 36/60
  checkpoints and no dependency-ready Todo. Root Markdown review passed 8 files,
  172 local links and 0 missing targets; `git diff --check` passed. KB item
  `8744faea-b9c1-4d89-8794-0bb3a71bdc87` was created in and read back from the
  canonical `erp-system-project-logic` KB with `production_verified=false`,
  `real_provider_verified=false` and `no_secrets=true`.

## Advertised response-size cleanup — 2026-09-11T11:11:23Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the current worktree reported 230
  dirty paths and all unrelated changes, release worktrees and the separate
  TASK-236 candidate were preserved. No provider credential, production request,
  alert sink, deployment, push or database mutation was used.
- **Expected:** Every document scanner, local-OCR and BYOK-Vision response that
  is rejected before parsing must release its response body. An advertised body
  larger than the shared 8 MiB limit must be cancelled before the bounded error
  reaches the worker, while the existing status/error contract remains unchanged.
- **Root cause:** `boundedResponseText()` rejected an oversized finite
  `Content-Length` before acquiring a reader but left the unconsumed response
  body open. Failed HTTP statuses used a separate inline cleanup path, so the
  ownership rule was duplicated.
- **Implementation:** `src/modules/documents/processingDrivers.ts` now uses one
  best-effort `cancelResponseBody()` helper for the advertised-size guard and
  non-success response path. Cleanup exceptions are swallowed so the original
  bounded application error remains authoritative; streamed overflow continues
  to cancel through its reader and release the reader lock in `finally`.
- **Actual:** The driver fixture now provides a readable oversized response with
  a cancellation spy. The local-OCR driver returns the same 8 MiB bounded error
  and the response body cancellation callback runs exactly once. Existing scanner,
  local-OCR and BYOK-Vision redirect, status, malformed-output, fingerprint and
  worker-readiness cases remain green.
- **Verification:**
  `npm test -- --run src/modules/documents/processingDrivers.test.ts
  src/modules/documents/processing.test.ts
  src/modules/documents/processingPolicyReadiness.test.ts --reporter=dot` passed
  **3 files / 41 tests**. `npm run lint`, `npm run typecheck`,
  `npm run typecheck:web`, `npm run demo` and `npm run build:demo` passed. The
  Demo build retained its existing classic-script, missing-static-asset,
  externalized Node module, browser-eval and chunk-size warnings. No schema,
  migration, UI or tenant/approval contract changed, so PostgreSQL and browser
  E2E gates were not repeated for this backend-only cleanup.
- **Acceptance delta / boundary:** TASK-205 now has stronger source evidence for
  the bounded response-body boundary and resource ownership on early rejection.
  Registry status, GOAL criteria and execution checkpoint counts remain unchanged.
  Production gateway/account/model/region/retention, live credential
  rotation/revocation, dead-letter alert/recovery and owner acceptance remain
  open; Demo/Codex OCR remains synthetic protocol evidence.

## Invalid response-size declaration cleanup — 2026-09-11T11:19:58Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the worktree still reports 230
  dirty paths and unrelated changes, release worktrees and the separate TASK-236
  candidate remain preserved. The fixture uses a synthetic response only; no
  provider credential, production request, alert sink, deployment, push or
  database mutation was used.
- **Expected:** The shared scanner, local-OCR and BYOK-Vision HTTP boundary must
  fail closed on malformed, non-decimal or unsafe-integer `Content-Length`
  declarations, cancel the unconsumed body and return a bounded application-owned
  error before parsing provider output.
- **Root cause:** The previous guard rejected only finite values above 8 MiB.
  `Number()` returned `NaN` for malformed declarations and those responses could
  continue to the body reader, so invalid transport metadata was not rejected at
  the ownership boundary.
- **Implementation:** `boundedResponseText()` now trims the header, requires only
  ASCII decimal digits and a safe integer, cancels the response body on invalid
  metadata, and preserves the existing 8 MiB advertised-size error for valid
  values. No worker state, tenant scope, approval rule or provider fallback changed.
- **Actual:** `processingDrivers.test.ts` supplies a readable body with
  `content-length: not-a-decimal-length`; the request fails with the fixed invalid
  length error, `fetch` runs once and the body cancellation callback runs once.
- **Verification:** The focused driver suite passes **1 file / 24 tests**. The
  related processing, driver and readiness regression passes **3 files / 42 tests**.
  The common lint, typecheck, Demo and Demo-build gates remain the previously
  recorded green results; this backend-only transport check does not add a schema,
  migration, UI, PostgreSQL or browser-E2E requirement.
- **Documentation / persistence:** `npm run docs:check` passes 79 Markdown files /
  795 local links; the exact GOAL count/dependency/fingerprint validator passes with
  240 tasks (226 done, 6 in progress, 5 todo, 3 blocked), 27/48 criteria, 36/60
  checkpoints and no dependency-ready Todo. Root Markdown/link/fragment review
  passes 8 files / 176 local links, and `git diff --check` passes. The canonical
  `erp-system-project-logic` KB item `79a9a5d5-2031-4b9f-aede-78558f7a393a` was
  updated and read back with `production_verified=false`,
  `real_provider_verified=false`, `no_secrets=true`, registry SHA-256
  `665de7d93bfad982218b5084e66fbb01839eb3f417604a48d511ffa9e08adbf3` and the
  current evidence hash recorded in metadata.
- **Documentation alignment:** `docs/AI_PROVIDERS.md` now states the same
  fail-closed response-body rule as the source and `docs/STATUS.md`/
  `docs/PROJECT_LOGIC.md`, including malformed or unsafe `Content-Length` and the
  advertised 8 MiB boundary. This is a documentation correction backed by the
  source and the 42-test regression; it does not promote any task, criterion or
  execution checkpoint.
- **Acceptance delta / boundary:** TASK-205 source evidence now covers malformed
  response-size metadata as a fail-closed case with cleanup. Registry, GOAL
  criteria and checkpoint counts remain unchanged. Production gateway/account/
  model/region/retention, credential rotation/revocation, delivered dead-letter
  alert/recovery and owner acceptance remain open; Demo/Codex OCR is still
  synthetic protocol evidence.

## Bounded JSON response shape — 2026-09-11T11:33:29Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the current worktree still reports
  230 dirty paths and unrelated changes, release worktrees and the separate
  TASK-236 candidate remain preserved. Synthetic HTTP fixtures only were used; no
  provider credential, production request, alert sink, deployment, push or
  database mutation occurred.
- **Expected:** A successful scanner, local-OCR or BYOK-Vision response must be a
  JSON object before service-specific fields are read. Syntax errors and JSON
  primitives/arrays must produce one bounded application-owned driver error rather
  than leaking parser or property-access exceptions; response-size errors must
  retain their existing messages.
- **Root cause:** `responseJson()` cast `JSON.parse()` output directly to a record.
  A malformed document response could therefore expose a native parse error, while
  `null` or a primitive reached field access and produced an unstable TypeError.
- **Implementation:** `responseJson()` now reads the bounded body first, catches
  only `JSON.parse()` failures, requires a non-null non-array object and returns the
  fixed `Document processing service returned an invalid JSON response.` error for
  invalid shapes. The bounded body reader remains outside that catch so its 8 MiB
  and invalid-`Content-Length` errors remain authoritative.
- **Actual:** The driver regression covers syntax-invalid JSON, `null`, arrays and
  empty extraction text. All malformed JSON shapes use the fixed error, while an
  object with blank `rawText` still returns the service-specific no-text error.
- **Verification:** The focused driver suite passes **1 file / 24 tests**. The
  related processing, driver and readiness regression passes **3 files / 42 tests**.
  Lint, root and Web typechecks, PGlite Demo and Demo build also pass. This
  backend-only contract repair adds no schema, migration, UI, tenant, approval,
  PostgreSQL or browser-E2E change; production provider and operational evidence
  remain separate.
- **Documentation / persistence:** `npm run docs:check` passes 79 Markdown files /
  795 local links; the exact GOAL count/dependency/fingerprint validator passes with
  240 tasks (226 done, 6 in progress, 5 todo, 3 blocked), 27/48 criteria, 36/60
  checkpoints and no dependency-ready Todo. Root Markdown/link/fragment review
  passes 8 files / 177 local links, and `git diff --check` passes. The canonical
  `erp-system-project-logic` KB item `79a9a5d5-2031-4b9f-aede-78558f7a393a` was
  updated and read back with `production_verified=false`,
  `real_provider_verified=false`, `no_secrets=true`, and current source/registry
  hashes recorded in metadata.
- **Acceptance delta / boundary:** TASK-205 now has a stable bounded error for
  malformed and non-object provider JSON at the driver boundary, while preserving
  worker failure/retry/manual-review behavior. Registry, GOAL criteria and
  execution checkpoint counts remain unchanged; production gateway/account/
  model/region/retention, credential rotation/revocation, dead-letter alert/
  recovery and owner acceptance remain open.

## Body-less response bound — 2026-09-11T11:46:55Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the 230-path dirty worktree,
  release worktrees and separate TASK-236 candidate remain preserved. The test
  uses a synthetic response object with `body: null`; no provider credential,
  production request, alert sink, deployment, push or database mutation occurred.
- **Expected:** Every successful document-processing response, including a runtime
  exposing only `text()`, must enforce the shared 8 MiB byte bound before JSON
  parsing and retain the existing bounded-size error.
- **Root cause:** The body-less branch previously returned `response.text()`
  directly, so an implementation without a readable stream could bypass the
  no-`Content-Length` byte limit.
- **Implementation:** The fallback now UTF-8 encodes the returned text, rejects
  more than 8 MiB with `Document processing service response exceeds the 8 MiB
  limit.`, and only then returns the text for the existing JSON object/shape guard.
  Streamed responses and their reader cancellation/release behavior are unchanged.
- **Actual:** The new regression supplies an 8 MiB + 1 body-less response and
  observes the fixed oversize error before provider field parsing; the complete
  processing/driver/readiness regression passes **3 files / 43 tests**.
- **Verification:** `npm run lint`, `npm run typecheck`, `npm run typecheck:web`,
  `npm run demo` and `npm run build:demo` pass. `npm run docs:check` passes 79
  Markdown files / 795 local links; the exact GOAL count/dependency/fingerprint
  validator passes with 240 tasks (226 done, 6 in progress, 5 todo, 3 blocked),
  27/48 criteria, 36/60 checkpoints and no dependency-ready Todo. Root
  Markdown/link/fragment review passes 8 files / 178 local links, and
  `git diff --check` passes.
- **Documentation / persistence:** Source/docs remain aligned in
  `docs/AI_PROVIDERS.md`, `docs/STATUS.md` and `docs/PROJECT_LOGIC.md`; task,
  criterion and checkpoint counts remain unchanged. The registry fingerprint is
  `078c9f72c72351b338c942dd5f576e07f80ed4c597911a426d49cddab3a67713`; the
  canonical KB item is updated and read back with the final evidence hash and
  `production_verified=false`, `real_provider_verified=false`, `no_secrets=true`.
  Production provider, rotation/revocation, dead-letter alert/recovery and owner
  acceptance remain open.

## Streamed response reader cleanup — 2026-09-11T11:56:24Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the 230-path dirty worktree,
  release worktrees and separate TASK-236 candidate remain preserved. The test
  uses a synthetic body reader whose `read()` rejects; no provider credential,
  production request, alert sink, deployment, push or database mutation occurred.
- **Expected:** A streamed document-processing response that fails during reading
  must fail closed, cancel the reader before the original transport error is
  rethrown, and release the reader lock on every exit. Cancellation failures must
  not hide the bounded or transport error that caused the failure.
- **Root cause:** The shared response reader only cancelled on the explicit 8 MiB
  overflow branch. A rejected `reader.read()` reached `finally`, which released
  the lock but left cancellation to the runtime, so the driver did not own cleanup
  for that transport-failure path.
- **Implementation:** `boundedResponseText()` now uses one guarded cancellation
  helper for streamed readers. The overflow branch invokes it before its fixed
  size error; the catch path invokes it for read/transport failures; the finally
  path always releases the lock. The helper suppresses cancellation failures so
  the original application-owned or transport error remains observable.
- **Actual:** The new regression supplies a body reader that rejects with
  `stream read failed` and observes that error unchanged, exactly one reader
  cancellation, and exactly one lock release. The complete processing/driver/
  readiness regression passes **3 files / 44 tests**.
- **Verification:** The focused regression passed. The required local gates passed after documentation and registry persistence: `npm run lint`,
  `npm run typecheck`, `npm run typecheck:web`, `npm run demo`, and
  `npm run build:demo` all exited 0; `npm run docs:check` passed 79 Markdown
  files / 795 local links; the exact GOAL count/dependency/fingerprint validator,
  root Markdown/link/fragment review (8 files / 179 local links) and
  `git diff --check` also passed.
- **Acceptance delta / boundary:** TASK-205 source response cleanup now covers
  streamed read failures as well as status, metadata and size rejection paths.
  Registry, GOAL criteria and execution checkpoint counts remain unchanged;
  production gateway/account/model/region/retention/health, credential
  rotation/revocation, dead-letter alert/recovery and owner acceptance remain
  open. Demo/Codex OCR remains synthetic and does not supply those external
  proofs.

## Paired health-check evidence — 2026-09-11T12:17:30Z

- **Actor / custody:** Codex on root `main` at `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the worktree remained dirty with 230 paths before this source/doc update. Existing release worktrees, including the separate TASK-236 candidate, were preserved. No credential, receipt secret, provider key or production mutation was used.
- **Expected result:** readiness must require a current health-check record together with a successful-probe record. A row carrying `health=healthy` and historical `lastSuccessAt` but no `lastCheckedAt` must remain `configured-provider-unverified` with `provider_health_unverified`.
- **Root cause:** the readiness projection previously treated `health=healthy` plus `lastSuccessAt` as sufficient even when the paired health-check timestamp was absent. `checkConnectorHealthWithin` already records `lastCheckedAt` and `lastSuccessAt` together when a live probe succeeds.
- **Implementation:** `getDocumentProcessingReadinessWithin` now requires both timestamps before setting `externalProviderReady`; the existing healthy fixture records the paired timestamp, and a new regression covers historical success without `lastCheckedAt`. The tenant scope, connector pause invalidation, secret omission and Demo/provider evidence boundaries are unchanged.
- **Actual source verification:** `npx vitest run src/modules/documents/processingPolicyReadiness.test.ts src/api/controlPlane.integration.test.ts --reporter=dot` passed 2 files / 7 tests; the broader processing/driver/readiness/connector regression passed 4 files / 51 tests. The fixture run `npx tsx scripts/receipt-assistant-pilot.ts --fixture` completed with `syntheticDataOnly=true`, `productionVerified=false`, persisted Pack/PDF read-back true, two synthetic receipt IDs and `humanViewedPdf=false`.
- **Actual Demo verification:** the registered-origin probe returned session HTTP 201 with a valid ephemeral `dmo_*` token shape and response HTTP 200, `status=completed`, one output item, provider `gpt-demo-gateway` and model `demo-auto`. The session token and response text were not saved or logged. This endpoint receives query text only; it is not the document Vision gateway and does not close production provider evidence.
- **Remaining boundary:** production gateway/account/model/region/retention, live rotation/revocation, delivered dead-letter alert, responder ownership and controlled recovery remain open. Demo/Codex OCR is synthetic evidence and requires no user-operated action, but it cannot satisfy those external gates.

## Persisted credential-envelope revalidation — 2026-09-11T12:31:27Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the worktree remains dirty with
  230 paths, unrelated changes and the separate TASK-236 candidate preserved.
  Tests use synthetic PGlite rows and no credential plaintext, provider key,
  production request, alert sink, deployment, push or external message.
- **Expected result:** a required connector credential must be a valid encrypted
  envelope at every decision boundary. A non-empty malformed stored value must
  fail closed when enabling the connector, checking health and projecting
  readiness; it must not report healthy, become ready or be serialized.
- **Root cause:** connector enable, health and readiness previously used Boolean
  presence for persisted `credentialEnvelope`. A stale or malformed row could
  therefore look configured after bypassing the configure command.
- **Implementation:** `setConnectorEnabledWithin`, `checkConnectorHealthWithin`
  and `getDocumentProcessingReadinessWithin` now revalidate required envelopes
  with `isEncryptedToken`. Enable rejects the row with the existing bounded
  `credentials_required` error; health records `warning` with
  `invalid_credential_envelope`; readiness returns
  `provider_credentials_invalid` and `externalProviderReady=false`. The
  secret-free projection, tenant scope, approval boundary and manual-retry
  policy are unchanged.
- **Actual verification:** the new readiness and connector regressions pass in
  the 3-file targeted run (**15 tests**). The complete processing/driver/readiness/
  connector regression passes **4 files / 53 tests**. The malformed fixture's
  `secret: plaintext` value is never returned by the readiness projection.
- **Common gates:** after the source and documentation updates, `npm run lint`,
  `npm run typecheck`, `npm run typecheck:web`, `npm run demo` and
  `npm run build:demo` exited 0. `npm run docs:check` passed 79 Markdown files /
  795 local links; the exact GOAL count/dependency/fingerprint validator passed
  240 tasks (226 done, 6 in progress, 5 todo, 3 blocked), 27/48 criteria,
  36/60 checkpoints and no dependency-ready Todo. Root Markdown/link review
  passed 8 files / 182 links, and `git diff --check` passed. Build warnings are
  the repository's existing classic-script/static-CSS/PGlite externalization and
  large-chunk warnings; they did not fail the build.
- **Acceptance delta:** TASK-205 source evidence now covers persisted credential
  integrity at enable, health and readiness boundaries. This is local source/
  PGlite evidence only; registry, GOAL criteria and execution checkpoint counts
  remain unchanged. Demo/Codex OCR remains synthetic and requires no user action.
- **Remaining boundary / owner / action:** the OCR operator with the security and
  operations owners must still provide an approved production gateway/account/
  model, region and retention scope, then observe live rotation/revocation and a
  delivered dead-letter alert with controlled recovery. No secret is requested or
  recorded here.

## BYOK credential revalidation at policy and worker boundaries — 2026-09-11T13:05:54Z

- **Expected result:** selecting `byok_vision` and processing a queued extraction must
  require a valid persisted encrypted-token envelope whenever the connector declares a
  credential requirement. A malformed non-empty value must fail closed before Vision
  egress and must not trigger a local-OCR fallback.
- **Environment / actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the worktree has 260 dirty paths and
  unrelated changes, including the separate TASK-236 candidate, were preserved. Tests
  use synthetic PGlite rows and injected API fixtures. No provider key, credential
  plaintext, production request, deployment, push, alert or external message was used.
- **Root cause:** readiness, connector enable and health already used
  `isEncryptedToken`, but the policy-selection command and the two worker extraction
  guards treated any truthy `credentialEnvelope` as usable. A bypassed or stale malformed
  row could therefore pass one boundary and reach later decryption or egress logic.
- **Implementation:** `configureDocumentProcessingPolicyWithin` now requires
  `isEncryptedToken(connector.credentialEnvelope)` for required BYOK credentials.
  `createExtractionAfterClean` and the extraction worker guard apply the same check
  before selecting or decrypting the provider credential. Tenant scope, approval
  permissions, transaction boundaries and the explicit manual-retry policy are unchanged;
  credential-free OpenAI-compatible endpoints remain eligible when the connector contract
  says a credential is not required.
- **Actual result:** policy selection with the malformed persisted envelope returns the
  existing `vision_connector_required` error. A directly seeded malformed policy produces
  an unavailable extraction with no Vision call and no local-OCR call; the persisted
  extraction has `provider=byok_vision`, `status=unavailable` and no raw text.
- **Verification:** the focused policy/processing/driver/API/governance regression passed
  **5 files / 52 tests**:
  `src/modules/documents/processingPolicyReadiness.test.ts`,
  `src/modules/documents/processing.test.ts`,
  `src/modules/documents/processingDrivers.test.ts`,
  `src/api/controlPlane.integration.test.ts` and
  `src/api/documentGovernance.integration.test.ts`.
- **Acceptance boundary:** this strengthens TASK-205's local fail-closed source gate.
  Registry, GOAL criteria, checkpoint and task status counts remain unchanged. Demo/Codex
  OCR is synthetic and requires no user action. Approved provider account/model, data
  region and retention policy, real extraction, rotation/revocation observation,
  delivered dead-letter alert and controlled recovery, and production/human acceptance
  remain open.

## Provider endpoint and egress ownership audit — 2026-09-11T14:19:26Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; `git status --short` reports 232
  dirty paths. Existing unrelated changes, detached source freeze and the separate
  TASK-236 candidate worktree were preserved. No provider key, credential plaintext,
  production request, deployment, push, alert delivery or external message was used.
- **Expected result:** the Agent provider endpoint, document Vision policy metadata and
  actual worker egress must have distinct, reviewable ownership. A Company value must
  not silently override a server egress boundary or bypass model/host validation.
- **Actual source result:** `receiptAssistantProvider.ts` uses the fixed
  `https://api.openai.com/v1/responses` adapter endpoint and requires enabled
  OpenAI/GPT-4.1-mini/global/no-training configuration before decrypting a credential.
  `providerConfiguration.ts` validates OpenAI-compatible endpoints as HTTPS URLs without
  credentials, query or fragment and matches them against the server allowlist. The
  document worker calls only the deployment-owned `DOCUMENT_VISION_GATEWAY_URL`; its
  validated `visionBaseUrl`, provider, model, region and retention values are sent as
  policy headers to that gateway and are not used as direct fetch destinations. The
  existing local-compatible HTTP URL fixture therefore does not create a browser or
  worker egress path by itself. No source defect was established in this audit.
- **Verification:** `npm test -- --run src/modules/agent/providerConfiguration.test.ts
  src/modules/documents/processingPolicyReadiness.test.ts
  src/modules/documents/processingDrivers.test.ts --reporter=dot` passed **3 files /
  39 tests**. No source or generated artifact changed during this audit.
- **Acceptance boundary:** this is source/configuration ownership evidence only;
  registry, GOAL criteria, execution checkpoint and task status counts remain unchanged.
  Demo/Codex OCR remains synthetic and requires no user action. The approved production
  gateway host, provider account/model, data region, retention policy, live credential
  rotation/revocation, delivered dead-letter alert and controlled recovery remain open.

## Optional connector envelope fail-closed boundary — 2026-09-11T14:30:39Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; `git status --short` reports 232
  dirty paths. Existing source/docs changes, release worktrees and the separate
  TASK-236 candidate were preserved. Tests used synthetic PGlite rows and injected
  provider functions only; no secret, provider request, deployment, push, alert
  delivery or external message was used.
- **Expected result:** a non-empty malformed connector envelope must fail closed even
  when `credentialRequired=false`: enable must reject it, health must not become
  healthy, readiness must not promote the provider, and the worker must not call
  Vision or local OCR. A null envelope must remain valid for the explicitly
  credential-free OpenAI-compatible path.
- **Root cause:** connector enable and health treated optional credentials as valid
  solely because the connector did not require a credential. Readiness also treated
  any optional non-empty value as configured, while the worker only revalidated a
  credential when the policy required one. A stale or malformed value could therefore
  cross the optional path without being used as a credential.
- **Implementation:** `connector.ts` now validates non-empty envelopes for optional
  connectors at enable and health boundaries; `processingPolicy.ts` reports malformed
  optional values as `provider_credentials_invalid`; and `processing.ts` rejects the
  same state before extraction creation and before worker egress. The explicit
  credential-free path with a null envelope remains unchanged. Tenant scope,
  approvals, retry/manual-review behavior and Demo/PostgreSQL schema parity are
  unchanged.
- **Actual result:** the new connector regression rejects optional malformed enable,
  records `warning`/`invalid_credential_envelope` and keeps the connector disabled.
  Readiness returns `credentialConfigured=false`, `externalProviderReady=false` and
  `provider_credentials_invalid`. The worker leaves extraction `unavailable` with
  `rawText=null` and calls neither Vision nor local OCR. The existing null-envelope
  OpenAI-compatible regression still passes.
- **Verification:** the focused connector/readiness/processing regression passed
  **3 files / 31 tests**; the authenticated control-plane API regression passed
  **1 file / 2 tests**. `npm run lint`, `npm run typecheck`, `npm run typecheck:web`,
  `npm run demo` and `npm run build:demo` exited 0. `npm run test:postgres` selected
  3 PostgreSQL files but skipped all 3 because no PostgreSQL test URL was configured;
  no PostgreSQL pass is claimed. Build output retained the repository's existing
  classic-script, externalized Node module and chunk-size warnings.
- **Acceptance delta:** TASK-205 local credential-custody evidence now covers both
  credential-required and explicitly credential-free connector states. Registry,
  GOAL criteria, checkpoint and task status counts remain unchanged. Production
  gateway/account/model/region/retention, live rotation/revocation, delivered
  dead-letter alert, controlled recovery and owner acceptance remain open.

## Local OCR HTTP worker extraction — 2026-09-11T16:12:39Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the existing dirty worktree and
  separate TASK-236/release worktrees were preserved. The run used an isolated
  PGlite database, a loopback-only temporary HTTP endpoint and local Tesseract
  5.5.3. No external provider, production database, alert sink or secret was
  used.
- **Expected:** a readable synthetic receipt sent to the deployment-shaped
  `createHttpLocalOcrExtractor` boundary must carry the governed source hash,
  pass the clean-scan gate, persist one successful `local_ocr` extraction and
  keep the production/real-provider flags false.
- **Input:** the existing synthetic Demo source `source-receipt.png`, 67,453
  bytes, SHA-256
  `4cb3d1be0e46bcd2ceffe1c5d36657fafdd6d507a975580dc5026ccd418ba96e`.
  The temporary endpoint ran `tesseract stdin stdout --psm 6` and returned the
  bounded JSON shape consumed by the shared HTTP driver.
- **Actual:** one loopback request was received; `processDocumentJobBatch()`
  reported `scansClaimed=1`, `clean=1`, `extractionsClaimed=1`,
  `extracted=1`, `failed=0` and `deadLettered=0`. The persisted extraction is
  `provider=local_ocr`, `model=tesseract-5.5.3-local`, `status=succeeded`, with
  raw text containing `Coffee Demo Pte Ltd`, `DEMO-234-0911`, `SGD 32.80` and
  output SHA-256 `9cb6d9ac008d95cac5c20fd2919c565511fde72338ce1360f4fd877f65bd28ee`.
- **Repeatable regression:** `src/modules/documents/processing.test.ts` now
  drives `createHttpLocalOcrExtractor()` through the worker and asserts the POST
  method, `redirect: 'error'`, MIME/source-hash headers, exact source bytes and
  successful persisted extraction. The focused processing test passes 1 file /
  17 tests; the processing/driver/readiness/control-plane regression passes 4
  files / 52 tests.
- **Acceptance boundary:** this closes a local HTTP Local OCR source/worker
  evidence gap and preserves the shared PGlite/PostgreSQL processing contract.
  It is not production OCR, approved external-provider, real-model, alert/recovery
  or business-owner evidence; TASK-205 remains `in_progress` until an OCR/security
  owner supplies approved provider/data policy and a controlled production outcome.

## Verification gates after local OCR HTTP worker — 2026-09-11T16:39:20Z

- **Actor / revision / state:** Codex root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the worktree remains dirty with
  unrelated user changes preserved, and the separate TASK-236/release worktrees
  remain untouched.
- **Full local regression:** `npm test -- --reporter=dot` passed **210 files / 986
  tests**, with **3 PostgreSQL-dependent files / 3 tests skipped** because the
  full run has no default PostgreSQL URL. Existing stderr cases are expected test
  fixtures; no test failed.
- **PostgreSQL parity:** `POSTGRES_URL=postgres://postgres@127.0.0.1:55432/postgres
  npm run test:postgres -- --reporter=dot` passed **3 files / 3 tests** against
  the disposable PostgreSQL 16 container `codex-erp-postgres-s5`.
- **Common gates:** `npm run lint`, `npm run typecheck`, `npm run typecheck:web`,
  `npm run demo`, `npm run build:demo`, `npm run docs:check`, the root Markdown/link
  review (`8 193 0`) and `git diff --check` all exited successfully. Demo and
  build output retained only the repository's existing warning classes.
- **Acceptance delta:** local HTTP OCR source/worker, PGlite persistence and
  disposable PostgreSQL parity are now evidenced and repeatable. Registry,
  GOAL criteria, execution checkpoint and task status counts remain unchanged.
  Production provider/account/model/region/retention, live rotation/revocation,
  delivered dead-letter alert/recovery and owner acceptance remain open.

## Cross-tenant Local OCR worker scope — 2026-09-11T16:46:28Z

- **Actor / custody:** Codex root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; isolated PGlite, no external
  provider, production database, alert sink or secret. The existing 233 dirty
  paths and separate candidate/release worktrees were preserved.
- **Expected:** one document in `M1/C-SG` and one in `M1/C-MY` claimed by the
  shared document worker must send each tenant's own source bytes and SHA-256 to
  Local OCR, then persist each extraction under the matching composite tenant
  scope. Cross-tenant byte/hash or persistence mixing must fail the regression.
- **Actual:** the worker claimed 2 scans and 2 extractions, completed 2 clean
  scans and 2 successful `local_ocr` extractions with 0 failures. The two source
  hashes (`45ae705277879f7f01d778f7c95a065bb0c06ab9936cf24307f375211fee13d1`
  and `2f601cb01fdd45b7816b3d6e93459d2c80b2513bfc56baf266762a161127b063`) and
  exact bytes were observed at the extractor boundary; persisted rows retained
  `M1/C-SG` and `M1/C-MY` respectively.
- **Repeatable regression:** `src/modules/documents/processing.test.ts` now
  drives both tenant jobs through one Local OCR worker and asserts source/hash
  correspondence plus composite-scope persistence. Focused processing passes
  **1 file / 18 tests**; the processing/driver/readiness/control-plane set
  passes **4 files / 53 tests**; lint and both typechecks pass.
- **Acceptance boundary:** this strengthens tenant-isolation evidence for the
  shared worker while preserving the production RLS/document-worker design.
  It does not prove production provider/account/model/region/retention,
  rotation/revocation, alert/recovery or business-owner acceptance; TASK-205
  remains `in_progress`.

## Verification after cross-tenant scope regression — 2026-09-11T17:08:11Z

- **Full local regression:** after the cross-tenant test, `npm test --
  --reporter=dot` passed **210 files / 987 tests**, with **3 PostgreSQL-dependent
  files / 3 tests skipped** because no default PostgreSQL URL was configured.
  The expected i18n fixture stderr was present; no test failed.
- **PostgreSQL parity:** the first combined `npm run test:postgres --
  --reporter=dot` observation returned two assertion failures while the three
  database suites were started together. Diagnostic single-file runs passed
  1/1 each, and the final disposable PostgreSQL 16 run with explicit
  `--no-file-parallelism --maxWorkers=1` passed **3 files / 3 tests**. The
  parallel observation is retained as a harness-stability note, not counted as
  a pass.
- **Common gates:** after the source test change, `npm run lint`,
  `npm run typecheck`, `npm run typecheck:web`, `npm run demo` and
  `npm run build:demo` exited successfully. Documentation gates are rerun after
  this dated record and progress update: the GOAL count/dependency validator
  passes, `npm run docs:check` reports 79 Markdown files / 795 local links,
  root Markdown/link review reports `8 195 0`, and `git diff --check` passes.
- **Acceptance delta:** the local worker now has direct evidence that a shared
  claim pass preserves composite tenant scope through source read, OCR egress
  and persisted extraction. Registry, GOAL criteria, execution checkpoint and
  task status counts remain unchanged; production provider/account/model/region/
  retention, rotation/revocation, delivered alert/recovery and owner acceptance
  remain open.

## Canonical PostgreSQL parity rerun after full regression — 2026-09-11T17:12:23Z

- **Environment / actor:** Codex root `main` at HEAD `a4b7982bcf10ac71d709740af80dc2e79991e1c5`,
  with the 233-path dirty worktree and separate candidate/release worktrees
  preserved. The disposable `codex-erp-postgres-s5` PostgreSQL 16 container was
  idle after the full PGlite run completed.
- **Actual:** the unmodified canonical command
  `POSTGRES_URL=... npm run test:postgres -- --reporter=dot` passed **3 files /
  3 tests** in 11.83 seconds. The earlier two assertion failures occurred only
  while the long full Vitest process was running concurrently; individual and
  explicit serial runs also passed. No production database or secret was used.
- **Acceptance delta:** PostgreSQL parity is now confirmed with the canonical
  command in a clean resource window; no test-script change or task/criterion/
  checkpoint status change is required. Production provider/account/model/
  region/retention, rotation/revocation, dead-letter alert/recovery and owner
  acceptance remain open.

## Documentation gates after canonical PostgreSQL parity — 2026-09-11T17:15:48Z

- **Actor / revision / state:** Codex root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the 233-path dirty worktree and
  separate candidate/release worktrees remain preserved.
- **Actual:** the exact GOAL count/dependency validator passed with registry
  `226 done / 6 in_progress / 5 todo / 3 blocked` (240 total), 27/48 goal
  criteria, 36/60 execution checkpoints, and no dependency-ready Todo.
  `npm run docs:check` passed with 79 Markdown files / 795 local links; the
  root Markdown/link review reported `8 196 0`; `git diff --check` passed.
- **Acceptance boundary:** these are documentation and consistency gates only;
  they do not promote TASK-205 or TASK-234, and they do not change registry,
  criterion, checkpoint or task status counts. Production provider/account/
  model/region/retention, rotation/revocation, dead-letter alert/recovery and
  owner acceptance remain open.

## Final documentation gate count after PROGRESS link update — 2026-09-11T17:16:32Z

- **Actual:** the same GOAL validator and `npm run docs:check` remain green with
  the unchanged registry/count projection (`226/6/5/3`, 27/48 criteria,
  36/60 checkpoints, no dependency-ready Todo). The root Markdown/link review
  now reports `8 197 0` because the new PROGRESS evidence row adds one root
  Markdown link; `git diff --check` remains green.
- **Acceptance boundary:** this is a final documentation-only recount; it adds
  no capability evidence and does not promote any task or goal status. The
  production provider and owner acceptance gaps remain open.

## Cross-tenant extraction policy and credential routing — 2026-09-11T17:47:11Z

- **Actor / revision / state:** Codex root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the 233-path dirty worktree and
  separate candidate/release worktrees remain untouched.
- **Expected:** a shared worker processing one `C-SG` Local OCR job and one
  `C-MY` BYOK Vision job must select each Company policy independently. The
  Malaysia job may receive only its own region, model, base URL and decrypted
  credential; the Singapore job must receive neither Vision settings nor a
  credential. Source bytes and SHA-256 values must remain paired with their
  original Company.
- **Actual:** the isolated PGlite regression processed 2 scans and 2 clean
  jobs with 2 successful extractions and 0 failures. Local OCR was called once
  with the Singapore bytes and no Vision parameters/credential; Vision was
  called once with the Malaysia bytes, `my` region, `my-vision-v1`, the
  Company-scoped HTTPS base URL and the expected in-memory credential. Persisted
  extraction rows retained `M1/C-SG` + `local_ocr` and `M1/C-MY` + `byok_vision`.
- **Verification:** focused processing test passes **1 file / 19 tests**;
  processing/driver/readiness/control-plane regression passes **4 files / 54
  tests**; full local Vitest passes **210 files / 988 tests** with 3
  PostgreSQL-dependent tests skipped; canonical `POSTGRES_URL=... npm run
  test:postgres -- --reporter=dot` passes **3 files / 3 tests**. Lint, both
  typechecks, Demo, Demo build, docs check and diff check pass. The test fixture
  credential is never written to evidence or output.
- **Acceptance delta:** shared-worker tenant/policy/credential routing is now
  directly evidenced across Local OCR and BYOK Vision while preserving the
  fail-closed production boundary. Production provider/account/model/region/
  retention, health, rotation/revocation, dead-letter alert/recovery and owner
  acceptance remain open; TASK-205 stays `in_progress`.

## Final documentation gate recount — 2026-09-11T17:51:18Z

- **Actor / revision / state:** Codex root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the 233-path dirty worktree and
  separate candidate/release worktrees remain preserved.
- **Actual:** the exact GOAL count/dependency validator passed with registry
  `226 done / 6 in_progress / 5 todo / 3 blocked` (240 total), 27/48 goal
  criteria, 36/60 execution checkpoints, and no dependency-ready Todo.
  `npm run docs:check` passed with 79 Markdown files / 795 local links; the
  root Markdown/link review reported `8 198 0`; `git diff --check` passed.
- **Acceptance boundary:** this recount verifies documentation consistency only;
  it does not promote TASK-205 or TASK-234 or alter registry, criterion,
  checkpoint or task status counts. Production provider/account/model/region/
  retention, rotation/revocation, dead-letter alert/recovery and owner
  acceptance remain open.
