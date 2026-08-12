# AI and Vision Provider Boundary

Reviewed: **2026-08-12**. This document separates the implemented governed document
Vision path from the still-unimplemented general ERP assistant.

## 1. Current implementation truth

| Capability | Status | Current boundary |
| --- | --- | --- |
| Setup-wizard AI choice | Preview only | The static local wizard lists OpenAI, Gemini, DeepSeek and LM Studio, but the provider/key stay in in-memory form state and are discarded on Finish/Back. They do not configure an adapter. |
| Local document OCR | Implemented worker boundary | Local OCR is the default document-processing policy. The worker calls the deployment-owned `DOCUMENT_LOCAL_OCR_URL`; unavailable/indeterminate extraction never makes an unsafe document clean. |
| BYOK document Vision | Implemented governed boundary | A Company may select `openai`, `google` or `openai_compatible` plus region and 0–365-day provider retention. The worker sends the document to the deployment-owned `DOCUMENT_VISION_GATEWAY_URL`. |
| General chat/reporting/NL-query assistant | Not implemented | No shared `LLMProvider.chat()` adapter, conversational route, browser direct-call runtime or permission-safe ERP tool layer exists in current source. |

Do not describe the setup-wizard preview as a working OpenAI/Gemini/DeepSeek/LM Studio
assistant. Do not describe PGlite or API builds as sending a wizard-entered key to a
provider.

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
- the `document-vision` integration connector stores a credential only as an encrypted
  envelope, requires server token-encryption configuration and never returns plaintext;
- `src/modules/documents/processing.ts` decrypts only inside the worker call boundary;
- `src/modules/documents/processingDrivers.ts` calls the deployment-owned gateway with
  bounded timeouts and provider policy headers;
- scan-clean state, immutable version/hash identity, extraction provenance and manual
  review remain authoritative even when a provider fails;
- OpenAI-compatible may be configured without a credential for a deliberately local or
  otherwise credential-free endpoint. That does not make an HTTPS browser origin able
  to call a local HTTP service directly; the configured server/gateway topology owns the
  network path.

Tests cover encrypted connector storage, credential non-disclosure, policy validation,
credential-required and credential-free OpenAI-compatible paths, fail-closed scanner/OCR
unavailability, retry and manual confirmation fallback. They do not directly prove a
Vision-gateway/provider failure path, automatic Vision-to-local-OCR fallback, a
particular third-party account, a region promise or a configured production gateway.

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

## 4. General ERP assistant target (not current functionality)

A future reporting or natural-language assistant must be a separate epic/task. Before it
is called Canonical it needs:

- a registered provider interface and server-side tenant authorization boundary;
- explicit read-only tools first, with bounded queries and field-level redaction;
- prompt-injection and document-content isolation, output validation and audit;
- per-tenant model/region/retention/cost policy, quotas and cancellation/timeouts;
- no direct business write unless the ordinary domain command, permission, scope,
  workflow approval, optimistic version and idempotency checks all run unchanged;
- Demo/API parity that does not put production/customer secrets into the static bundle;
- provider-specific integration and failure tests plus an honest production configuration
  check.

Until that work is registered and implemented, the supported AI surface is governed
document extraction only. See [SECURITY.md](SECURITY.md),
[PROJECT_LOGIC.md](PROJECT_LOGIC.md) and [STATUS.md](STATUS.md) for the surrounding
document, credential and release boundaries.
