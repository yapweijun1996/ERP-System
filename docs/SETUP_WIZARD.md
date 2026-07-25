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
2. **Interactive prompts** — `make setup-interactive` (`scripts/setup.sh --interactive`)
   asks for a bundled-vs-external database, DB password / connection string, setup
   token, encryption key, public URL, and checks host ports for collisions —
   auto-generating strong secrets on a blank answer instead of shipping
   `DB_PASSWORD=change-me`. Done, EPIC-025/TASK-060. Only takes effect on a first-time
   `.env` (still never overwrites an existing one). See
   [DEPLOYMENT.md](DEPLOYMENT.md#connecting-to-an-already-provisioned-external-database)
   for the external-database case.
3. **Desktop installer** — bundle Docker Desktop detection + a one-click launcher.
   (Future; largest effort.)

For now Phase A targets engineers; the in-app wizard (Phase B) is where the *user*
experience lives.

---

## Phase B — In-app first-run wizard (shared by demo & production)

Once the stack is up (or the demo loads), the app detects **first run** and launches a
guided wizard. Production uses the server's zero-user setup state; the browser demo uses
its local completion flag and a seeded reference master. The same visible wizard is used
in both modes — the demo simply has no Phase A.

The wizard is part of the real frontend, not a separate prototype. It must work with the
same UI shell and data adapter strategy described in [FRONTEND_PLAN.md](FRONTEND_PLAN.md).

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

For production, `POST /api/setup/actions/complete` now writes the tenant foundation to
PostgreSQL in one transaction. It is available only while there are zero users and
requires the deployment-only `ERP_SETUP_TOKEN` in `X-ERP-Setup-Token`. The API creates
the master, first company, Superadmin, permissions, effective-dated tax rule and base
chart of accounts, then permanently marks setup complete. In API mode the wizard asks
for the installer-provided token, keeps it only in page memory and sends it in
`X-ERP-Setup-Token`; it is never placed in the JSON body or localStorage. The public
demo continues to write to PGlite/IndexedDB and can be reset for visitors. Because its
reference master already contains demo identities, the wizard proposes an
organisation-derived username such as `admin.acme` instead of the seeded `admin`.
Username and email collisions are rejected before any company or master change, so a
failed setup remains a clean retry rather than exposing a database constraint error.

### First-run detection
- Production checks the one-time setup state on the server. The static demo uses
  `aria-setup-wizard-complete`; reset clears the browser database and returns to the
  wizard.
- The wizard writes through the **same data layer** as everything else, so it works
  against PGlite (demo) and the API/PostgreSQL (prod) without special-casing.
- Production setup is a privileged, one-time deployment action. The raw setup token is
  never accepted in JSON or stored in the database; after the first admin exists the
  command returns `409 already_initialized`.

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
