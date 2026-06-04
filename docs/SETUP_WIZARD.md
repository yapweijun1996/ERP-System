# Setup Wizard

"Easy setup for end users and engineers" is **two different problems**. Designing them as
one wizard fails, because one phase runs before any app exists and the other runs inside
the running app.

```
Phase A — Host bootstrap      (NO app running yet → cannot be a web GUI)
   install Docker → write .env → bring the stack up
        │
        ▼
Phase B — In-app first-run wizard   (app is up → GUI, shared by demo & prod)
   create master/company → country+tax → language → admin user → LLM provider
```

---

## Phase A — Host bootstrap (engineer / installer)

Nothing is running, so this **cannot** be an in-browser wizard. It is a script.

### Engineer
```bash
make setup        # → scripts/setup.sh: .env + docker compose up + wait DB + migrate + seed
```
Idempotent, prints URLs when done. See [DEPLOYMENT.md](DEPLOYMENT.md#first-run-setup--one-command).

### Non-technical end user
Be honest: **installing Docker is the real friction** for a non-technical user. Options,
from least to most effort to build:
1. **Guided script** — `scripts/setup.sh` already checks for Docker and gives a clear
   error/instructions if missing. Good enough for a semi-technical user.
2. **Interactive prompts** — an optional `make setup-interactive` that asks for DB
   password, base port, etc., instead of editing `.env` by hand. (Future.)
3. **Desktop installer** — bundle Docker Desktop detection + a one-click launcher.
   (Future; largest effort.)

For now Phase A targets engineers; the in-app wizard (Phase B) is where the *user*
experience lives.

---

## Phase B — In-app first-run wizard (shared by demo & production)

Once the stack is up (or the demo loads), the app detects **first run** (no master
configured) and launches a guided wizard. Same wizard in both modes — the demo simply has
no Phase A.

### Steps
1. **Welcome / language** — pick UI language (en/ms/zh/ja/vi) up front so the rest of the
   wizard is localized. See [I18N.md](I18N.md).
2. **Create master** — the top tenant (group/holding name) → `master_fn`.
3. **Add company** — one legal entity:
   - country (**SG** / **MY**), which sets **currency + tax regime** (GST/SST) →
     [LOCALIZATION.md](LOCALIZATION.md).
   - repeatable: add the MY company after the SG one (or vice-versa).
4. **Admin user** — create the first user, assign to the company/companies (M:N) →
   [MULTI_TENANCY.md](MULTI_TENANCY.md#4-user--company-is-many-to-many).
5. **AI provider (optional)** — choose OpenAI / Gemini / DeepSeek / LM Studio and enter a
   key. **BYOK: the key is the user's own, kept user-side, in both demo and production —
   the system never stores a provider key.** → [AI_PROVIDERS.md](AI_PROVIDERS.md#2-how-byok-works-same-in-both-modes).
6. **Finish** — seed optional sample data; land on the dashboard.

### First-run detection
- The app checks for an existing master on boot. None → wizard. Exists → normal login.
- The wizard writes through the **same data layer** as everything else, so it works
  against PGlite (demo) and the API/PostgreSQL (prod) without special-casing.

---

## Why the split matters

| | Phase A (host) | Phase B (in-app) |
| --- | --- | --- |
| Runs when | nothing is up yet | app is running |
| Form factor | shell script / installer | web GUI |
| Audience | engineer (now); end-user installer (future) | every user, both modes |
| Configures | Docker, `.env`, DB, migrations | tenants, country/tax, language, users, AI |

Trying to make Phase A a web wizard is impossible (no server to serve it). Trying to make
Phase B a shell script throws away the friendly GUI that the demo needs. Keep them
separate.
