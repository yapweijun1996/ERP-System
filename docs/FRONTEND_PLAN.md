# Frontend Maintenance Plan

> **Status (2026-08-12):** the original frontend build-out plan is complete and this
> file now describes the maintained architecture and next quality boundary. Current
> truth lives in [DESIGN.md](DESIGN.md), [STATUS.md](STATUS.md) and
> [ERP_EXCELLENCE_REVIEW.md](ERP_EXCELLENCE_REVIEW.md).

## 1. Product and source boundary

The Aria ERP prototype in `references/ui/aria-erp/` remains the visual baseline for
shell density, tables, forms, drawers and responsive behavior. It is not a data,
authorization or workflow source of truth.

Current canonical boundaries are:

- Drizzle schema and migrations under `src/data/schema/` and `drizzle/`;
- transactional domain commands under `src/modules/`;
- tenant derivation and authorization under `src/api/` and `src/auth/`;
- a vanilla-JavaScript shell under `web/public/assets/`, registered through the global
  `SCREENS` map in the fixed `web/index.html` script order;
- a bundled TypeScript Demo/report runtime under `web/src/`;
- parallel Demo/PGlite and authenticated API/PostgreSQL adapters.

Do not create a browser-only domain rule, duplicate a server-side money/stock command
in raw SQL, or treat prototype literals as implemented ERP data.

## 2. Current runtime modes

| Mode | Build | Data path | What it proves |
| --- | --- | --- | --- |
| Static Demo | `npm run build:demo` | Browser -> shared runtime -> PGlite -> IndexedDB | Installable, resettable showcase using sample data |
| API | `npm run build` | Browser -> authenticated Node API -> PostgreSQL | Server-enforced authorization and transactional behavior |

The static Demo has local persona access and entitlement fixtures but no real Platform
credential realm. The hosted API Demo may explicitly enable editable sample Platform
autofill and one-click login. That flag is presentation-only, defaults off for customer
builds and is not deployment or security proof.

## 3. Current inventory and honest parity boundary

Source registers 129 Canonical routes and no Preview routes. API-screen metadata now
covers all 129, including `staff-calendar`. The current HEAD screen audit covers every
route at desktop and 375px; the five-language and authenticated API evidence are recorded
as separate gates rather than inferred from the route registry.

The current full Vitest run passes 172 files/697 tests with two intentional file/test
skips. Historical checkpoints remain dated in STATUS.

## 4. Next frontend priorities

1. **Close security-visible UI gaps.** Hide Company Receipt create actions from
   read-only users, recheck Receipt Pack visibility after permission changes and keep
   originals export purpose-bound and audited.
2. **Finish the Company Receipt operator journey.** Add real detail/reopen,
   metadata/date correction and void actions; make the evidence picker eligible-only,
   searchable and paginated; decide how non-Employee finance users capture evidence.
3. **Maintain route parity.** All 129 Canonical routes now declare API support,
   including `staff-calendar`; `audit:screens` fails closed on future metadata gaps.
   Keep the Demo screen audit, Staff Calendar API/Demo proofs and authenticated API
   browser checks separate when changing route contracts.
4. **Preserve financial and locale accuracy.** Keep Decimal values as strings/Decimal
   objects until formatting, use Company calendar/timezone presets and render exported
   PDFs with locale resources and Unicode fonts.
5. **Maintain recoverable workflows.** Existing-Company provisioning must resume
   idempotently, a new Company form must start blank, and unsaved tenant forms must not
   leak into the independent Platform realm.

## 5. Acceptance gates for a frontend change

- both `npm run build:demo` and `npm run build` pass;
- `npm run typecheck:web`, affected unit/integration tests and relevant static audits
  pass;
- changed workflows are exercised in the correct mode at desktop and 375px, with no
  console errors, overflow, inaccessible action or false-success state;
- authorization is enforced at API/domain boundaries and reflected honestly in the UI;
- money, date-only fields and immutable evidence are not coerced through lossy browser
  types;
- PGlite and API adapters preserve the same business contract;
- documentation distinguishes source-present, tested-now, deployed and live-verified.

Production release still requires the independent target-host role verification,
recovery, current revision and operational UAT gates in EPIC-066; a successful
frontend build cannot satisfy them.
