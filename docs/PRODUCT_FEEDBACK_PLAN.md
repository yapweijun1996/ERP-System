# Product Feedback and Agent Issue Intake — Plan and Initial Deployment

Status: initial API, data and human-triage slice deployed on 2026-09-24 at revision `b8c0208aae430d26d672ce10f2a62ad88f068f71`. The production migration, forced RLS, immutable-event trigger and public release verifier passed; no Agent principal or product-case grant exists in production, so no internal Agent has been activated and no live submission was made. This is not acceptance of the complete feedback-to-release loop. [EPIC-069](EPICS.md) and TASK-244–249 in [`tasks/tasks.jsonl`](../tasks/tasks.jsonl) own the remaining delivery. Named assignees and service targets remain to be set by the product owner.

## Implemented initial slice (2026-09-24)

- `product_case` and `product_case_event` share the canonical Drizzle/PGlite/PostgreSQL schema and Company scope. Creation and transitions write a case event and central audit in one tenant transaction. The production RLS policy list includes both tables; a disposable PostgreSQL role-isolation test proves the non-bypass API role cannot read another Company's case or mutate an existing case event.
- A distinct ERP Agent credential can call `POST /api/agent/cases` with `Authorization: Bearer <credential>` and an `Idempotency-Key`, then `GET /api/agent/cases/{id}` for its own case. The caller stores this ERP-issued credential in its own secret environment, such as `ERP_AGENT_API_KEY` in an uncommitted `.env`; an OpenAI/Gemini provider key is not accepted as ERP identity. The existing Agent Governance workspace issues one-time credentials and separate `product_case.submit` and `product_case.read_own` grants. Revocation and accountable-owner checks use the existing Agent identity layer.
- `GET /api/product-cases`, `GET /api/product-cases/{id}` and `POST /api/product-cases/{id}/transitions` provide a Company-scoped human queue, history and status transitions through dedicated permissions. The API-mode Admin > Product Cases screen supports type/status filters, detail and human transitions. The Demo screen displays an API-only state instead of simulating governed writes.
- The implemented submission contract is intentionally smaller than the target below: `caseType` (`feedback` or `ticket`), bounded `title`, `description`, optional `routeKey` and `referenceId`. The implemented states are `submitted`, `triaged`, `in_progress`, `resolved` and `closed`. It does not yet support evidence upload/append, duplicate links, engineering-task or deployed-revision linkage, independent post-release verification, notifications, a distributed rate limiter or a direct end-user submission form. Those are still delivery gates, not completed features.
- Focused API tests cover grant/authentication, exact, concurrent and changed-payload replay, cross-Agent denial, sensitive-field rejection, revocation, human transition and audit. Local desktop/375px browser triage was exercised. The affected Admin and Agent Governance screens passed the five-language desktop/mobile i18n browser matrix. Hosted CI and public release verification passed; authenticated production submission remains untested until an approved Agent cohort is activated.

### Internal pilot guardrails

- Intake accepts at most 8 KiB of JSON per request and returns a generic `413` for excess data. Malformed/oversized bodies are not copied into API error logs. Bounded field validation still applies after parsing.
- The process-local intake guard permits at most 10 POST attempts per Agent and 50 per Company per rolling minute, returning `429` and `Retry-After` when exhausted. All attempts, including exact retries and invalid payloads after authentication, count. This pilot guard is valid only while one API instance serves the endpoint. Before multiple replicas, replace or reinforce it with a shared gateway/distributed limiter; do not interpret these counters as cluster-wide.
- The production-only RLS overlay adds a PostgreSQL trigger preventing UPDATE/DELETE of `product_case_event`, including by a runtime role that has generic table DML. The application still writes events only through the transactional command layer. The overlay must be reapplied after the additive migration and verified as the non-bypass API role.
- Roll out to a small internal cohort by issuing credentials and grants only to named accountable Agents. With no product-case grants, the endpoint remains inaccessible even when deployed. Pause or revoke the Agent principal/grants to stop further authenticated intake while preserving human read/triage. This is a cohort control, not a substitute for a global emergency switch or shared rate limiter.
- Production release requires a restrictive-permission backup and isolated restore, migration rehearsal on that restore, schema/RLS checks, local/CI regression gates, an exact target Compose project, release-revision proof, public health/asset proof, and a read-back of case counts. Do not seed/reset or restart PostgreSQL for this additive release. A database migration is not reversed by an application-only rollback; keep the old application compatible with the new empty tables.

For API-mode use, a Company administrator creates an accountable Agent in **Admin > Agent Governance**, issues its one-time ERP credential, and grants `product_case.submit` and `product_case.read_own` to that Agent. The accountable owner must retain the matching Company permissions. Copy the one-time credential into the calling Agent's private, uncommitted environment as `ERP_AGENT_API_KEY`; do not put it in this repository, frontend assets, a provider-key variable, or a request body. Send it only as `Authorization: Bearer` over HTTPS in deployed environments. Example request body: `{ "caseType": "ticket", "title": "Quotation save fails", "description": "Describe the observed behavior and reproduction steps.", "routeKey": "quotation" }`. A fresh `Idempotency-Key` identifies one submission intent and must be reused only for retries of that same payload. An administrator with `product.cases.read` and `product.cases.manage` can triage it in **Admin > Product Cases**.

## Outcome and scope

An authorized Company Agent can submit an evidence-backed product defect or improvement, receive a stable case ID, add bounded evidence, and read its verified outcome. Product/support staff can triage, link an engineering task, record the deployed revision, verify the original observation, and close or reopen the case. A later human-facing submission channel may use the same case model; it is outside v1.

The existing `service_ticket` aggregate covers customer warranty and maintenance, not ERP product feedback. Feedback creation never grants ERP business-action authority, changes financial or HR facts, creates a development task automatically, or authorizes deployment. Serious incidents retain the existing operational escalation path; feedback can link to an incident after triage.

## Existing boundaries to reuse

- `src/api/routes/agent.ts` authenticates a distinct Agent credential and rejects body-supplied actor and tenant identity.
- `src/modules/agent/agentIdentity.ts` resolves current, Company-scoped Agent grants and accountable owner authority.
- `src/api/agentActions.ts` currently gates its receipt-only dispatcher on `expenses_tax`. Product feedback must work even when that module is disabled. Add a dedicated Agent feedback route using the shared identity/grant checks; do not route feedback through the receipt-specific module gate.
- `src/api/audit.ts` and tenant transactions provide the existing audit pattern. Demo/PGlite and production/PostgreSQL must share the same domain contract, while production RLS and concurrency require their own proof.

## Target interfaces beyond the initial slice

| Operation | Authorized caller | Result |
| --- | --- | --- |
| `POST /api/agent/cases` | Active Agent with `product_case.submit` grant | Implemented: `201` with case ID and `submitted` status; exact retry returns the original result. |
| `GET /api/agent/cases/{id}` | Submitting Agent with `product_case.read_own` grant | Implemented: current state, safe status history and resolution for its own Company case. Release and verification summaries are future fields. |
| Agent case evidence append route (not yet named) | Submitting Agent with a future evidence grant | Planned: append one bounded, scoped evidence reference and return its ID; retries are idempotent. |
| `/api/product-cases` reads and `/{id}/transitions` | Human session with dedicated product-case permissions | Implemented: Company-scoped queue, detail/history and guarded status transitions. Classification, duplicate link, assignment, task/release link and independent verification remain planned. |

Both Agent writes require an `Idempotency-Key` generated for one caller intent. Persist a hash of the key and a canonical payload digest under a Company/Agent uniqueness constraint. Same key and same payload return the original result, including concurrent retries. Same key and different payload return `409`. A new key with identical feedback is a distinct observation; semantic deduplication links cases without discarding their occurrences. Reads must never reveal that another Company's ID exists.

The create input has `kind` (`defect`, `usability`, `improvement`), bounded `title` and `summary`, `expected`, `observed`, `reproductionSteps`, `impactHint`, `routeKey`, optional client-declared revision/environment and scoped `evidenceRefs`. A defect requires an actual observation and at least one traceable evidence reference. Server-owned fields include tenant, Agent principal, accountable owner, receipt time, request correlation and any release revision verified by the server. Agent confidence and impact are unverified hints, never the priority or a business fact. Reject unknown identity fields, oversized inputs, raw secrets and unapproved evidence locations; v1 does not accept arbitrary file uploads or complete raw logs.

Return structured `400/422` validation, `401` authentication, `403` grant/owner denial, `409` idempotency or version conflict, `413` size limit, `429` rate limit and `503` temporary failure results. Retryable failures must not create a case without its required audit evidence. Set concrete size/rate/retention budgets in TASK-244 from a small pilot, rather than inventing production limits here.

## Logical records and state

| Record | Required fields and invariant |
| --- | --- |
| `product_feedback_case` | `id`, `master_fn`, `company_fn`, `source`, Agent principal and owner attribution, category and bounded report fields, route/revision context, `status`, `resolution_code`, same-Company `duplicate_of_id`, task/release references, optimistic `version`, timestamps, create-key hash and payload digest. Unique create key per Company and Agent. |
| `product_feedback_evidence` | Case/tenant key, allowed evidence type, protected reference, digest, visibility, reporter and time. No inline credential or bulk source payload. |
| `product_feedback_event` | Append-only case/tenant key, transition or evidence event, authenticated actor, prior/new state, reason code and time. Case projection, event and central audit metadata commit atomically. Sensitive free text remains under case/evidence access control rather than being copied into audit. |

Normal states: `submitted -> triaged -> accepted -> in_progress -> released -> verified -> closed`. `needs_info` pauses triage. A triaged case may close with a reason such as `duplicate`, `not_reproducible`, `declined` or `answered`. A fixed case needs a linked deployed revision before `released`, independent post-release evidence before `verified`, and an outcome visible to the reporter before `closed`. Reopening appends an event and returns the case to triage without erasing earlier release or verification facts. `duplicate_of_id` may point only to an authorized case in the same Company.

## Roles, privacy and failure handling

- Agent: submit, read own case and append bounded evidence only. It cannot assign priority, transition state, read another Agent's private case, approve a fix or deploy.
- Product/support triager: classify, request information, link duplicates, set priority and assign an owner under human-session permissions.
- Engineer: link the tracked fix and candidate revision. QA or an independent verifier: record reproduction and post-release result. Release owner: link the actual deployed revision. Product owner: accept or decline product changes and approve case closure policy.
- Platform-wide review receives sanitized metadata by default. Raw Company evidence requires an explicit, audited support access path. Treat all report text as untrusted data when an Agent or reviewer uses an AI tool.
- Store the case and required audit event in one transaction. Keep the case available if an external development tracker or notification system fails; retry those downstream links separately. Apply per-Agent and per-Company backpressure, with a disable switch that preserves read and triage access to existing cases.

## Work packages and delivery gates

| Task | Owner role | Dependencies | Exit |
| --- | --- | --- | --- |
| TASK-244 | Product Manager and Tech Lead | TASK-171, TASK-232 | Approve v1 contract, permission/visibility matrix, budgets, triage ownership and status rules. |
| TASK-245 | Backend/Data Engineer | TASK-244 | Ship tenant schema, migration, append-only case evidence, atomic audit and PostgreSQL RLS/Demo parity proof. |
| TASK-246 | Agent/API Engineer | TASK-245 | Deliver Agent submit/read/evidence API with revocation, scope, replay and negative-path proof. |
| TASK-247 | Platform/Frontend Engineer; Product Support reviewer | TASK-245 | Deliver human triage, safe duplicate links, optimistic decisions and accessible queue. |
| TASK-248 | QA and Release Engineer | TASK-246, TASK-247 | Bind tracked fix, deployed revision, independent verification, outcome read-back and reopen. |
| TASK-249 | Product Operations and SRE | TASK-248 | Canary internal Agents, monitor quality/latency/recurrence, rehearse disable/recovery and hand over ownership. |

Acceptance must include valid/paused/revoked/expired/owner-downgraded Agent cases; body-supplied identity and cross-Company denial; exact sequential and concurrent retries; changed-payload conflict; audit failure rollback; malformed/oversized/sensitive input; same-Company-only duplicates; every state guard; Demo/API shared behavior; disposable PostgreSQL non-bypass-RLS proof; and release/result read-back. Run affected repository schema, generated-artifact, permission, lint, typecheck, Demo, test and documentation gates during implementation. Planning this work does not claim those gates passed.

The initial north-star measure is the share of actionable cases with a verified post-release outcome communicated to the reporter. Supporting measures are valid Agent finding rate, duplicate/false-positive rate, time to first triage, time to verified closure and recurrence after release. Set targets after the internal pilot establishes a baseline.
