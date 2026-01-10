---
name: llm-provider-setup-openai-gemini
description: "Set up LLM providers for an app using OpenAI and Google Gemini: configure environment variables and secrets safely, choose models, implement a provider interface, add retries/timeouts, validate with smoke tests, and document operational constraints."
version: "1.0"
tags: [workflow, sop, dev, backend, docs, agent]
---

# Goal
Enable an application to use OpenAI and/or Google Gemini reliably and safely by standardizing configuration (secrets, env vars), model selection, provider abstraction, error handling, and verification.

# When to Use
- You’re adding LLM functionality to a new or existing app and need OpenAI and/or Gemini working end-to-end.
- You need a consistent, secure setup that works across local/dev/staging/prod environments.

# Inputs
- Runtime: Node.js, Python, or another language (use the project’s existing stack).
- Provider(s): OpenAI, Gemini (Google AI Studio), or Gemini via Vertex AI (GCP).
- Deployment environment(s): local, staging, production and the secret storage approach.
- Constraints:
  - Never commit API keys/tokens; use environment variables and a secret manager.
  - Prefer a provider-agnostic interface so you can swap models/providers without large refactors.
  - Add timeouts, retries, and rate-limit handling from day 1.

# Output
- A working provider setup for OpenAI and/or Gemini with:
  - Documented env vars and secret handling
  - A provider interface (one call shape used by the app)
  - Model configuration (default + fallback)
  - Basic resilience (timeouts/retries/backoff) and logging
  - A smoke test that proves requests succeed end-to-end

# Procedure
1. Clarify provider mode and compliance constraints.
   - Decide: OpenAI API, Gemini API (AI Studio), or Gemini via Vertex AI.
   - Record any constraints: data retention policy, region requirements, PII rules, logging redaction.
2. Define configuration contract (env vars only; no secrets in repo).
   - OpenAI:
     - `OPENAI_API_KEY`
     - Optional: `OPENAI_BASE_URL` (only if using a proxy), `OPENAI_MODEL`
   - Gemini (AI Studio):
     - `GOOGLE_API_KEY` (or `GEMINI_API_KEY` if your org standardizes on it)
     - Optional: `GEMINI_MODEL`
   - Vertex AI (Gemini on GCP):
     - `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`
     - Credentials via workload identity/service account (don’t store JSON keys if avoidable)
3. Decide the app-level provider interface (single abstraction).
   - Define one internal function signature (example):
     - `generateText({ provider, model, system, messages, temperature, maxTokens })`
   - Ensure the interface supports:
     - Text generation
     - Structured output (JSON) if needed
     - Streaming (optional) and tool/function calling (optional)
4. Choose default models and fallback strategy.
   - Pick a default model per provider for your use case (cost/latency/quality).
   - Define fallback rules:
     - Retry same provider/model for transient failures.
     - If provider outage: fail over to the other provider (if acceptable).
     - If rate-limited: exponential backoff + optional queueing.
5. Implement safe request behavior.
   - Add request timeout (hard cap) and cancellation support.
   - Add retries with exponential backoff + jitter for:
     - timeouts, 429s, transient 5xx/network errors
   - Do not retry non-idempotent operations unless you have an idempotency strategy.
6. Implement safety and redaction defaults.
   - Never log full prompts/responses containing user data by default.
   - Log metadata instead: provider, model, request id, latency, token counts (if available), error class.
   - If you store prompts for debugging, add explicit opt-in and redaction rules.
7. Add smoke tests (minimal, deterministic).
   - One test per provider that:
     - Sends a tiny prompt (no secrets/PII)
     - Expects a non-empty response
     - Validates timeouts and basic error handling paths
   - Keep it runnable locally and in CI using env vars (skip if keys are not present).
8. Document operations and limits.
   - Rate limits and expected errors (429, quota, invalid key).
   - Cost controls: max tokens, truncation strategy, caching strategy (if applicable).
   - Model/version pinning policy and change management.

# Verification (Acceptance Checks)
- [ ] No secrets are committed; env vars are documented and provided via secret manager.
- [ ] OpenAI and/or Gemini calls succeed via a smoke test in the target environment.
- [ ] Provider interface is used by the app (no scattered direct SDK calls).
- [ ] Timeouts and retries/backoff are implemented and validated (at least via controlled failure).
- [ ] Logs do not contain sensitive prompt/response content by default.

# Failure Modes & Recovery
- **If authentication fails (401/403)**: confirm correct key and environment injection → verify project/organization access → rotate key if leaked.
- **If rate limits/quota errors occur (429)**: reduce concurrency → add backoff/queueing → request quota increase → add caching.
- **If responses are slow/time out**: lower max tokens → stream responses → choose a faster model → add tighter timeouts.
- **If model output is inconsistent**: improve system prompt → add structured-output constraints → add validation + retry with repair prompt.
- **If missing info**: ask user “Are you using Node or Python, and do you want Gemini via AI Studio API or Vertex AI?”

# Examples
## Example A
**User request:** “Set up OpenAI + Gemini for my Node app; don’t commit secrets.”
**What you do:** Define env vars → implement provider interface → add timeouts/retries → add smoke scripts/tests gated by env → document model defaults and logging redaction.
**Result:** Two providers working locally and in staging with consistent app-level API and safe operations.

## Example B
**User request:** “We must use GCP; set up Gemini with Vertex AI.”
**What you do:** Use workload identity/service account auth → configure project/location → implement provider wrapper → add smoke test in staging → document region/compliance constraints.
**Result:** Vertex-based Gemini setup that avoids static key files and is deployable in production.

# Notes (optional)
- Prefer a single “LLM gateway” module: all prompts go through it so you can enforce logging, safety, and retries consistently.
- Treat prompts as user data; handle them with the same care as PII unless proven otherwise.
