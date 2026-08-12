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
make setup        # → scripts/setup.sh: .env + docker compose up + wait DB + migrate; no Demo seed
```
Idempotent, prints URLs when done. See [DEPLOYMENT.md](DEPLOYMENT.md#first-run-setup--one-command).

### Non-technical end user
Be honest: **installing Docker is the real friction** for a non-technical user. Options,
from least to most effort to build:
1. **Guided script** — `scripts/setup.sh` already checks for Docker and gives a clear
   error/instructions if missing. Good enough for a semi-technical user.
2. **Interactive prompts** — `make setup-interactive` (`scripts/setup.sh --interactive`)
   asks for a bundled-vs-external database, DB password / connection string,
   encryption key, public URL, and checks host ports for collisions —
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

For production, the former anonymous `POST /api/setup/actions/complete` tenant foundation
flow is retired and returns `410 legacy_setup_disabled`. A truly empty database first
offers `POST /api/setup/platform-superadmin/actions/complete`: one locked transaction
creates an independent `platform_principal`, one-hour platform session and
`__platform__` audit event, then the Platform Superadmin workspace creates the Master and
Company in separate idempotent steps. The first Company transaction creates SG/MY
localization/tax/control-plane/chart facts, inherited Company allocation, an immutable
Master Admin and a separate Company Owner. Tenant onboarding cannot choose modules.
Non-empty, partially initialized or concurrently claimed databases return `409
already_initialized`; the public registration never creates `app_user` or `erp_session`.
The public demo continues to write to PGlite/IndexedDB and can be reset for visitors.
Username/email/login-code collisions and dependency conflicts are rejected before a
partial Master/Company mutation, while a Master-without-Company state is a supported
continuation point in the platform workspace.

### First-run detection
- Production checks the staged setup state on the server. `GET /api/setup/status` reports
  `requiresPlatformBootstrap`, `hasPlatformAdmin`, `hasMaster`, `hasCompany`,
  `hasTenantAdmin` and `isFreshDatabase`. The static demo uses
  `aria-setup-wizard-complete`; reset clears the browser database and returns to the
  local wizard.
- The wizard writes through the **same data layer** as everything else, so it works
  against PGlite (demo) and the API/PostgreSQL (prod) without special-casing.
- Production setup is a one-time empty-database bootstrap. After the first admin exists
  the command returns `409 already_initialized`, and a database with any tenant
  foundation rows is rejected before setup begins.

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

## Platform-owned module provisioning (EPIC-064)

TASK-186 removes module purchase/allocation from Phase B tenant setup. Company Owner
and Company Admin cannot list or mutate entitlement through the retired tenant API.

Before a new Company reaches module-dependent onboarding, Platform Superadmin defines
the Master purchased entitlement and one default Company allocation set. Company
creation applies that set automatically. The tenant wizard offers no module selector,
Enable/Disable action or entitlement API. Missing Master entitlement/default allocation
fails closed rather than assuming all modules are purchased.

TASK-185 now stores the versioned entitlement/default and exposes the platform-only
API. TASK-186 applies defaults during trusted Master/Company bootstrap and removes the
legacy modules stage, so this is now the live setup boundary.

TASK-187 now provides a separate one-hour, no-Remember-Me Platform Superadmin password
realm, Master/Company workspace and exact-user simulation. It remains outside the
tenant setup session: a Platform Superadmin returns to the platform workspace before
switching Company or signing out of a simulated tenant view.

## First production identity and provisioning (EPIC-065)

This is an independent platform realm, not a renamed tenant admin. Public registration
is intentionally available only while all `platform_principal`, Master, Company, tenant
user, membership/role and setup-state counts are zero. The first successful caller claims
the database; the accepted residual risk is a first-caller takeover window before the
operator completes registration. The Platform Superadmin password is hash-only, the
session is capped at one hour and Remember Me/MFA are not part of v1.

After registration:

1. Create a Master and select only commercial Module Catalog entitlements/default
   Company allocation (baseline services are not sellable).
2. Continue from the Master empty state to create the first Company, enter distinct
   Master Admin and Company Owner credentials, and let the transaction create
   localization, tax, control-plane, chart and live onboarding facts.
3. Create later Companies with only a Company Owner; the system reuses the Master Admin
   identity and adds an immutable system-managed membership/assignment.

Master Admin is limited to dashboard, company switching, user/role/audit/settings
administration. It cannot use commercial modules, workflows, payments, payroll, MAC,
support, simulation or any `platform.*` permission. TASK-193 (email reset) remains
blocked while production SMTP is unset. TASK-192 completed the 2026-08-12 deployment and
exact-volume reset; production is intentionally waiting on the first Platform Superadmin
registration and no real account was created.

### Demo quick-setup presentation flag

The API-mode demo build can set `VITE_PLATFORM_DEMO_AUTOFILL=true` to prefill the three
Platform provisioning stages with public sample values and expose a dismissible “Demo quick
setup · sample accounts” notice. The source default and all real-customer builds remain
`false`. This is presentation-only: the two Master/Company mutations stay separate, use
stable form-fingerprint Idempotency-Key values, and still require the same server-side CSRF,
permission, uniqueness, audit and transaction checks. A visitor may edit every prefilled
field; an existing Company is never overwritten. Do not enable the flag for customer data.
