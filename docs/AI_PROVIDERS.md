# AI and Vision Provider Boundary

Target design: [GOAL.md](../GOAL.md), especially G07/TASK-234, tracks the locally implemented
server AI contract/workspace and the remaining real-provider integration. G03 provides the inbound ERP MCP
server; G04 provides outbound external MCP connections. Inbound MCP is locally evidenced; outbound MCP remains planned. These boundaries
do not replace the governed Vision pipeline below.

Reviewed: **2026-09-10**. This document separates the implemented governed document
Vision path from the local Receipt assistant and its locally connected provider runtime and open live-account gate.

## Default browser Demo gateway — 2026-09-10

The user selected `https://gpt.yapweijun1996.com/demo` as the default for the
browser Demo Receipt assistant. `receipt-demo-gateway.js` requests an ephemeral
session for `github-pages` on submission, then calls `/demo/v1/responses` with
`demo-auto`. The registered origin must permit the ERP site. Live preflight verified the
published `https://yapweijun1996.github.io` origin (session 201 and synthetic
query 200); `http://127.0.0.1:4397` was rejected with 403. This is protocol
evidence, not deployment or end-to-end Pack acceptance. No provider/private
key is used; session tokens are never saved or logged. No startup inference occurs.

The supplied gateway guide disables native tools. The model therefore proposes
only a validated search string from the user's request. Explicit date fields and
existing search filters remain authoritative; ERP selects the exact records and
runs its existing preview/confirmation/creation commands. No receipt files or
Company records are sent. Transport and invalid output fail visibly without a
silent fallback. The response is bounded to 64 KiB and the run to 60 seconds;
cancellation aborts HTTP. Monetary cost is unavailable, not zero.

Live protocol recheck — 2026-09-10: the registered Pages origin received HTTP 201
for the `github-pages` session and HTTP 200 for a bounded `demo-auto` response whose
sanitized proposal was `{"search":"Cafe"}`. The unregistered local preview origin
still receives HTTP 403. No session token, credential, receipt file or Company data
was saved or logged. This verifies the browser Demo gateway protocol only; it does
not activate the production server assistant or document OCR.

This browser path does not reconfigure API-mode Company providers or document
OCR, and does not establish the original server six-tool live pilot as complete.

## 1. Current implementation truth

| Capability | Status | Current boundary |
| --- | --- | --- |
| Setup-wizard AI choice | Preview only | The static local wizard lists OpenAI, Gemini, DeepSeek and LM Studio, but the provider/key stay in in-memory form state and are discarded on Finish/Back. They do not configure an adapter. |
| Local document OCR | Implemented worker boundary | Local OCR is the default document-processing policy. The worker calls the deployment-owned `DOCUMENT_LOCAL_OCR_URL`; unavailable/indeterminate extraction never makes an unsafe document clean. |
| BYOK document Vision | Implemented governed boundary | A Company may select `openai`, `google` or `openai_compatible` plus region and 0–365-day provider retention. The worker sends the document to the deployment-owned `DOCUMENT_VISION_GATEWAY_URL`. |
| Server AI provider configuration | Local foundation implemented | TASK-234/S1-S2 define the server provider request/response/tool-call contract, bounded run policy and Company-scoped `agent_provider_config` with AES-GCM credentials, allowlisted models/exact HTTPS egress and secret-free browser/audit views. No real provider account or network model call is claimed. |
| Contextual Receipt assistant | Local workspace implemented; live provider gate open | TASK-234/S3 adds the server-owned bounded six-tool conversation loop, cited facts, exact Pack preview, G06 confirmation bridge, governed execution and persisted/artifact verification. S4 adds the contextual vanilla-JS workspace with Company/draft isolation, visible sources, progress/cancel/recovery, five locales, both themes and desktop/375px focus/touch evidence; S5 passes Demo/PGlite and local gates. It uses an injected deterministic zero-spend fixture locally; no approved real-provider account or network model call is available. |

Do not describe the setup-wizard preview as a working OpenAI/Gemini/DeepSeek/LM Studio
assistant. Do not describe PGlite or API builds as sending a wizard-entered key to a
provider.

## Receipt assistant runtime connection — 2026-09-09

`openAiProvider.ts` implements the fixed `https://api.openai.com/v1/responses`
endpoint, mapping configured `gpt-4.1-mini` to pinned snapshot
`gpt-4.1-mini-2025-04-14`. It supports text and custom ERP functions only. Wire
function names map bijectively to canonical actions; assistant calls and tool
results preserve call IDs. Non-strict function schemas preserve optional ERP
fields; the existing ERP parser/dispatcher still validates every invocation.
Responses are bounded by bytes, output characters and token usage; malformed,
incomplete, unknown-tool, wrong-model, redirect and credential-echo output fails
closed. Network exceptions and provider error bodies are never returned verbatim.

`receiptAssistantProvider.ts` resolves the session Company inside tenant
transactions, decrypts its credential server-side and returns its runtime limits.
Only enabled OpenAI/GPT-4.1 mini, `dataRegion=global` and
`dataPolicy=tenant_no_training` are supported. Tenant-local/tenant-only policies and
other providers/models are rejected, never silently replaced. Before every egress,
configuration and resolved Agent grants are rechecked; changes require a fresh run.
Only granted pilot tools are advertised. No transaction spans the network call.

`receiptAssistantBootstrap.ts`, `src/server.ts` and Compose now connect the resolver.
Activation requires `ERP_RECEIPT_ASSISTANT_ENABLED=true`, an explicit
`ERP_RECEIPT_ASSISTANT_AGENT_KEY`, `ERP_TOKEN_ENCRYPTION_KEY` and all three settings:
`ERP_RECEIPT_ASSISTANT_INPUT_MICROS_PER_MILLION`,
`ERP_RECEIPT_ASSISTANT_OUTPUT_MICROS_PER_MILLION`,
`ERP_RECEIPT_ASSISTANT_MAX_OUTPUT_TOKENS`. Rates must be reviewed positive integer
micro-USD per million tokens; no default price or spend approval is inferred.
The Company run budget must cover a reservation for the full 1,047,576-token model
context plus configured maximum output (16–32,768 tokens). This intentionally
conservative reservation is reconciled after valid usage; cached input uses the
full configured input rate, so the result is an upper-bound estimate, not an invoice.

`store:false`, foreground execution and no hosted tools limit application-state
retention; they do not assert zero abuse-monitoring retention or regional residency.
The approved provider account/data policy is still an external acceptance gate.
See official [function calling](https://developers.openai.com/api/docs/guides/function-calling),
[model bounds](https://developers.openai.com/api/docs/models/gpt-4.1-mini) and
[data controls](https://developers.openai.com/api/docs/guides/your-data), reviewed
2026-09-09. Local injected HTTP fixtures exercise this connection; no live provider
call, deployment or production evidence is claimed. A credential alone cannot
activate the assistant. See [the active plan](GOAL_EXECUTION_PLAN.md).

## 2. Governed document Vision flow

```text
Company processing policy
  -> local_ocr (default)
  -> byok_vision
       -> provider: openai | google | openai_compatible
       -> explicit region + retention days
       -> encrypted document-vision connector when a credential is required
       -> server worker -> configured Vision gateway
       -> versioned extraction provenance and confidence
```

The current contract is intentionally server/worker mediated:

- `src/modules/documents/processingPolicy.ts` validates provider, region, retention,
  absolute credential-free base URL and model metadata;
- the `document-vision` integration connector accepts only a validated AES-GCM envelope,
  requires server token-encryption configuration and never returns plaintext; configuring
  it again replaces the prior envelope, while pausing it revokes worker use without
  deleting the audit/history boundary;
- `src/modules/documents/processing.ts` decrypts only inside the worker call boundary;
- `src/modules/documents/processingDrivers.ts` calls the deployment-owned gateway with
  bounded timeouts and provider policy headers;
- scan-clean state, immutable version/hash identity, extraction provenance and manual
  review remain authoritative even when a provider fails;
- provider HTTP failures, malformed/empty responses and transport timeouts remain a
  failed or unavailable extraction and are retried explicitly by the worker lease. The
  worker allows five automatic attempts by default, then records `dead_letter` on the
  scan/extraction job and document signal; `retryDocumentProcessing` is the explicit
  operator requeue boundary and preserves the same document/version/extraction identity;
- the selected fallback policy is **manual retry/review**. A Vision failure never silently
  invokes local OCR, so a local OCR result cannot be mistaken for the requested provider's
  provenance or policy boundary;
- OpenAI-compatible may be configured without a credential for a deliberately local or
  otherwise credential-free endpoint. That does not make an HTTPS browser origin able
  to call a local HTTP service directly; the configured server/gateway topology owns the
  network path.

Tests cover encrypted connector storage, credential non-disclosure, envelope validation,
credential rotation and pause/revocation behavior, policy validation,
credential-required and credential-free OpenAI-compatible paths, direct gateway 4xx/5xx,
malformed/empty output and transport timeout, paused/revoked connector denial, and
retry/manual-review behavior that preserves one document/version extraction without
automatic local-OCR fallback, including bounded dead-letter and same-chain manual requeue
behavior. They do not prove a particular third-party account, a region promise, live
dead-letter alert/recovery operations or a configured production gateway. Those remain
TASK-205 production-readiness evidence.

## 3. Secret and privacy rules

- No provider credential may be committed, seeded, logged, included in audit before/after
  payloads or exposed through a public read API.
- Provider keys must never use a `VITE_*` variable; Vite would publish them in the web
  bundle.
- The setup-wizard preview key is memory-only and discarded. The governed document
  Vision credential is different: it is deliberately persisted **server-side in
  encrypted form** so a background worker can process documents. The older blanket claim
  that this ERP never stores any provider credential is therefore false.
- BYOK does not remove data-governance duties. Provider, endpoint, region, retention,
  credential requirement, purpose, actor and extraction provenance must remain explicit.
- No AI/Vision result may silently post stock, money, tax, payroll, payment or approval
  decisions. OCR/Vision output is a suggestion until the governed workflow confirms it.

## 4. General ERP assistant target (beyond the Receipt pilot)

A future reporting or broader natural-language assistant must extend the TASK-234
server boundary; the S3 Receipt pilot is not an unrestricted reporting or SQL gateway.
Before a broader assistant is called canonical it needs:

- a registered provider interface and server-side tenant authorization boundary (the
  provider/configuration foundation and bounded Receipt loop are present; the OpenAI pilot adapter is connected locally; the broader assistant is not);
- explicit read-only tools first, with bounded queries and field-level redaction;
- prompt-injection and document-content isolation, output validation and audit;
- per-tenant model/region/retention/cost policy, quotas and cancellation/timeouts;
- no direct business write unless the ordinary domain command, permission, scope,
  workflow approval, optimistic version and idempotency checks all run unchanged;
- Demo/API parity that does not put production/customer secrets into the static bundle;
- provider-specific integration and failure tests plus an honest production configuration
  check.

The implemented surfaces are governed document extraction and the local
Receipt-pilot runtime/workspace. A real-provider or broader ERP assistant is not
proven by the local fixture. See [SECURITY.md](SECURITY.md),
[PROJECT_LOGIC.md](PROJECT_LOGIC.md) and [STATUS.md](STATUS.md) for the surrounding
document, credential and release boundaries.

## Receipt runtime cost custody — 2026-09-09

Dispatched failures retain their maximum cost reservation because transport failure
cannot prove that the provider did not bill. Valid reported costs reconcile only
their own call and remain recorded if the output is rejected. Costs above the
adapter's declared per-call maximum fail closed. Assistant results expose
`reservedCostMicros` (known spend plus unknown exposure) separately from
`spentCostMicros` (valid reported spend); the next tool turn deducts charged
exposure and previously consumed retries. No invoice, live pricing or external
provider activation is established by this local budget contract.

## Reproducible Receipt pilot runner

From the repository root, use `npx tsx scripts/receipt-assistant-pilot.ts --fixture`
for SG, or append `--my` for MY. Omitting the mode also selects fixture. These runs
use synthetic receipts, synthetic scan-clean evidence and injected Responses; they
never use an inherited provider key or invoke a paid model. They exercise ordinary
login, Company scope, individual governed receipt detail reads, authenticated source
file retrieval/hash verification, assistant preview, simulated exact confirmation, governed
execution, database reopen and saved PDF hash verification. This is not scanner,
OCR, live-provider, production or business-owner acceptance.

Before confirmation, every preview row must match a successful `receipt.get` result
by receipt version, document identity/version and source hash. Missing or stale details
stop the pilot. Exact source versions are retrieved through the authenticated document
API and saved as `source-receipt-<id>.pdf` with verified byte hashes; the operator
review includes their local paths. This proves source retrieval, not that a model
understood an image or a human viewed it. `humanViewedSources` stays false.

Each run creates a new private directory under the OS temporary directory and
prints its path. `evidence.json` and `receipt-pack.pdf` use atomic private writes;
the private `database/` holds the persisted synthetic records. Keep this directory
private and retain it only as long as required. The ephemeral encryption key is
not saved, so a live credential cannot be reused from the saved database. Reports
exclude credentials, envelopes, cookies, model text and execution intent keys.
A failed run retains a sanitized failure report; missing usage is marked unavailable,
not zero. Successful fixture cost fields are synthetic estimates, not actual spend.

Only after separate account, pinned-model, global/no-training data-policy and spend
approval may an interactive operator run `npx tsx scripts/receipt-assistant-pilot.ts
--live` (append `--my` for MY). Supply these via the approved secret/environment
mechanism, never committed files or pasted command-line credentials:

| Variable | Required meaning |
| --- | --- |
| `TASK234_LIVE_APPROVED` | Exactly `true`, only after actual authorization |
| `TASK234_APPROVAL_REFERENCE` | Non-secret approval reference; letters/digits and `._:-`, 3–101 characters |
| `TASK234_OPENAI_API_KEY` | Approved account credential, server-only |
| `TASK234_MAX_COST_MICROS` | Positive per-run ceiling, at most 1,000,000 (USD 1) |
| `TASK234_INPUT_MICROS_PER_MILLION` | Reviewed USD micro-units per million input tokens |
| `TASK234_OUTPUT_MICROS_PER_MILLION` | Reviewed USD micro-units per million output tokens |
| `TASK234_MAX_OUTPUT_TOKENS` | Reviewed output bound, 16–32,768 |

The approval flag records prior authorization; setting it does not grant permission.
Both stdin/stdout must be interactive. Review the exact preview and type its complete
selection digest to approve; any different answer cancels without Pack creation.
The fixed endpoint/model and existing conservative reservation/retry rules apply.
There is no automatic rerun after failure. Usage cost remains a configured-rate
estimate rather than a provider invoice. Inspect the PDF separately: the report
keeps `humanViewedPdf: false`, even after saving and hash verification.
