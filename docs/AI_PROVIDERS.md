# AI / LLM Providers

The ERP supports multiple LLM providers — **OpenAI, Google Gemini, DeepSeek, and
LM Studio** (local) — behind a pluggable adapter. This powers AI features (reporting
assistant, natural-language queries, document extraction) without locking to one vendor.

---

## 0. This ERP is BYOK — the system never owns a provider key

> **Bring Your Own Key.** Every user / tenant supplies **their own** LLM API key at
> runtime, in **both demo and production**. The system **never ships, stores in build, or
> manages a master provider key.** There is no server-side key vault to secure, no
> per-tenant secret for us to be custodian of.

What this removes (the "no worry" part):
- No master API key to provision, rotate, or leak.
- No server-side secret management / secrets manager dependency.
- No billing on our side — each user pays their own provider.

What still holds (small, but real):
- A user's key is **entered at runtime and kept on the user's side** (browser
  storage / their own config) — never compiled into the app.
- 🔴 **No key is ever `VITE_`-prefixed.** Vite inlines `VITE_*` vars into the static
  `dist/`; a `VITE_OPENAI_KEY` would be published to the world. `VITE_DATA_MODE` is a safe
  *mode switch*, not a secret. (This is the only hard rule left, and BYOK already keeps us
  clear of it because keys are runtime input, not build vars.)

---

## 1. Two adapters, not four

Three of the four providers speak the **OpenAI-compatible** API — same request shape,
different `base_url` + key. So the abstraction is really two adapters:

| Adapter | Providers | How it varies |
| --- | --- | --- |
| **OpenAI-compatible** | OpenAI, DeepSeek, LM Studio | just `base_url` + `api_key` (+ model) |
| **Gemini** | Google Gemini | different request/response schema |

```
LLMProvider (interface: chat(), embed?())
  ├── OpenAICompatibleProvider   base_url: api.openai.com | api.deepseek.com | localhost:1234/v1
  └── GeminiProvider             Google GenAI schema
```

Adding another OpenAI-compatible vendor = a config row (base_url + key), not new code.

## 2. How BYOK works (same in both modes)

The flow is identical in demo and production — that is the point of BYOK:

1. The user enters their provider, model, `base_url` (for OpenAI-compatible), and **their
   own key** in the AI settings / first-run wizard.
2. The key is stored **on the user's side** (browser storage, scoped to that user). It is
   never sent to our build, never required as a server secret.
3. AI calls go **directly from the browser to the chosen provider** using that key.
4. No key → AI features are simply disabled. Nothing breaks.

Because the call is client→provider, there is **no master key on any server** to protect.

> Optional hardening (only if a provider's CORS blocks direct browser calls — see §3): the
> request may be relayed through the Node API, passing the user's key **per-request without
> persisting it**. Even then we never *store* a key — we forward the user's. Default is
> direct client→provider.

## 3. Browser-call caveats (apply wherever calls are client-side — verify per provider)

Since BYOK calls go browser→provider, these constraints apply in **both** modes:

- **CORS:** not every provider allows direct browser calls. OpenAI requires an explicit
  "allow browser" acknowledgement; some providers block cross-origin entirely. Verify per
  provider; if blocked, use the optional per-request relay in §2.
- **Mixed content:** **LM Studio is `http://localhost:1234`.** A page served over **HTTPS**
  (the public Pages demo, or a TLS production deploy) calling `http://localhost` is
  **blocked by the browser**. So **LM Studio works when the app itself is served over
  http/local** (a local engineer or an on-prem http deployment), **not from an HTTPS
  origin.**

## 4. Configuration surface

| Setting | Where it lives | Secret? |
| --- | --- | --- |
| Active provider | user/session settings | no |
| Model name | user/session settings | no |
| `base_url` (OpenAI-compatible) | user/session settings | no |
| **API key** | **user's own, entered at runtime, stored user-side (BYOK)** | yes — but it's the *user's*, never ours, never in build |

There are **no provider keys in `.env`** — BYOK means the system doesn't hold one. Only
non-secret defaults (a suggested provider/model) may be configured; the key always comes
from the user.

## 5. Why pluggable matters

- **Cost/sovereignty:** a client may require a local model (LM Studio) for data that
  cannot leave premises, or DeepSeek for cost — switch by config.
- **Resilience:** provider outage → flip provider without code change.
- **The abstraction is small** (two adapters) because most providers converged on the
  OpenAI API shape.

> Architecture rule: a provider key reaching the client bundle is a release blocker. The
> `VITE_` check in §0 is enforced in review.
