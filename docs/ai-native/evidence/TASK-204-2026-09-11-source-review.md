# TASK-204 — Official SG/MY tax-source recheck — 2026-09-11

Date: 2026-09-11, Asia/Singapore. This record prepares the qualified tax-owner
review required by TASK-204. It is source evidence and a decision checklist, not
tax advice, a filing determination, an accounting approval or production sign-off.
TASK-204 remains `in_progress`.

## Scope and identity

- **Revision:** root `main` at `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the
  worktree was already dirty (200 entries at inspection), and unrelated changes
  were preserved.
- **Actor and environment:** Codex, read-only official-source review from the
  local repository; no production configuration, tenant record or tax rule was
  changed.
- **Expected result:** refresh the SG/MY rate, threshold and transition facts;
  map them to the current effective-dated resolver; expose any source conflict
  that a qualified owner must resolve before release.
- **Actual result:** the source facts below were confirmed on 2026-09-11. The
  official sources expose a Malaysia rental/leasing rate and exemption update that
  conflicts with an older MySST FAQ page, so no tax configuration change is safe
  without owner selection of the authoritative version.

## Source-backed matrix

| Area | Current official observation | Effective date / threshold | ERP implication and open decision |
| --- | --- | --- | --- |
| Singapore GST standard rate | IRAS states the current GST rate is 9%; its historical table records 8% for 2023. | 8%: `[2023-01-01, 2024-01-01)`; 9% from `2024-01-01`. | The seeded `C-SG/SR` rows match these bounded rate facts. The owner must approve the production registration status and account mapping; the rate rows alone do not establish compliance. |
| Singapore GST registration | IRAS requires registration when taxable turnover is more than S$1 million under either the retrospective calendar-year view or the prospective next-12-month view. | Retrospective: apply 1–30 January after the year-end and register 1 March. Prospective: apply within 30 days; for liability arising on/after 1 July 2025, registration starts two months after the forecast. | Registration liability is not represented by the `tax_rule` rate row. The owner must decide whether this release models registration/eligibility or explicitly excludes it. |
| Singapore GST transition | IRAS says a supply straddles the 8%→9% change when invoice issuance, payment or basic tax point occurs wholly or partly on/after 1 January 2024. Parts may require 8%/9% allocation and credit-note/new-invoice correction. | The document date alone is insufficient for these straddling transactions. | Current resolver intentionally selects by document date. The owner must approve supported time-of-supply inputs and correction behavior before claiming transitional compliance. |
| Malaysia service tax baseline | Royal Malaysian Customs states 8% from 1 March 2024, except F&B, logistics, telecommunications and parking at 6%; credit/charge cards use RM25 per card. | 6%: `[2018-09-01, 2024-03-01)`; general 8% from `2024-03-01`. | A generic `sst_service` rate cannot safely stand for all categories. Classification-specific rows and owner-approved exemptions are required. |
| Malaysia expanded services | The current MySST background lists 1 July 2025 expansion: rental/leasing, construction, financial, private healthcare and education, with category-specific rates. It lists rental/leasing at 6% from 1 January 2026, construction 6%, financial 8%, private healthcare 6% and education 6%. | Categories and dates are separate facts; registration thresholds are service-specific and use historical/future 12-month methods. | The owner must choose the supported category set and encode each category as an effective-dated, source-backed rule. |
| Malaysia rental/leasing conflict | The current MySST expansion FAQ still states rental/leasing is 8% from 1 July 2025 with a RM500,000 registration threshold. The current MySST background and the 5 January 2026 MOF notice state the rate was reduced from 8% to 6% from 1 January 2026; MOF also raises the SME customer exemption threshold from RM1 million to RM1.5 million and grants a one-year exemption for newly established SMEs. | The FAQ and the later background/MOF notice are not interchangeable. The RM500,000 provider registration threshold must be distinguished from the RM1.5 million customer exemption threshold. | **Owner decision required:** select the controlling order/version, model provider registration versus customer exemption separately, and add a dated rule/transition fixture. Do not silently replace the seeded 8% row. |
| Malaysia construction transition | MySST describes 6% construction tax and proportional treatment across the effective date; the MOF notice extends the exemption for qualifying pre-1 July 2025 contracts without a reviewable clause through 30 June 2027. | Pre/post work and payment/retention treatment need separate facts. | The owner must approve the supported construction contract and retention cases or keep them out of the release scope. |

Official sources reviewed:

- [IRAS current GST rates](https://www.iras.gov.sg/taxes/goods-services-tax-%28gst%29/basics-of-gst/current-gst-rates)
- [IRAS GST registration](https://www.iras.gov.sg/taxes/goods-services-tax-%28gst%29/gst-registration-deregistration/do-i-need-to-register-for-gst)
- [IRAS transitional rules for the 2024 rate change](https://www.iras.gov.sg/taxes/goods-services-tax-%28gst%29/gst-rate-change/gst-rate-change-for-business/transitional-rules-for-gst-rate-change)
- [MySST service-tax FAQ](https://mysst.customs.gov.my/faq-services-tax/)
- [MySST background](https://mysst.customs.gov.my/background/)
- [MySST service-tax expansion FAQ](https://mysst.customs.gov.my/faq-expansion-of-service-tax-scope-2025/)
- [MySST registration and service thresholds](https://mysst.customs.gov.my/registering-business/)
- [Malaysia MOF SST policy notice, 5 January 2026](https://mof.gov.my/portal/images/2026/01/05/Siaran-Media-Pemakluman-Dasar-Dikemaskini-Berhubung-Cukai-Jualan-Dan-Cukai-Perkhidmatan-SST.pdf)

## Current source mapping

The current Demo seed contains:

| Company / code | Current row | Effective interval | Review boundary |
| --- | --- | --- | --- |
| `C-SG/SR` | `GST`, `gst_standard`, `8%`, 100% input recovery | `[2023-01-01, 2024-01-01)` | Synthetic source metadata and Demo approval; not production owner approval. |
| `C-SG/SR` | `GST`, `gst_standard`, `9%`, 100% input recovery | `[2024-01-01, ∞)` | Same boundary; transitional time-of-supply behavior is outside this single row. |
| `C-MY/SV` | `SST`, `sst_service`, `8%`, 0% input recovery | `[2025-07-01, ∞)` | Generic Demo rule; it cannot represent the current category-specific and 2026 rental update. |

The source fields (`source_url`, `source_effective_date`, `approved_by_user_id` and
`reviewed_at`) exist in `tax_rule`, and `resolveTaxPostingProfile` fails closed for
unclassified or regime-incompatible facts. No code or seed change was made here:
the official-source conflict must be resolved by the qualified owner before a new
rule can be authoritative. Malaysia remains non-recoverable by default; positive
recovery requires the explicit `sst_deductible` classification.

## Required owner decisions

Before TASK-204 can be marked Done, a qualified SG/MY tax owner must record:

1. The authoritative source/version for each supported SG GST and MY SST category,
   including the rental/leasing conflict above.
2. Registration thresholds versus customer exemptions, effective dates, exemptions,
   transitional time-of-supply rules and credit/debit-note or retention corrections.
3. Input-tax recoverability and account mapping for every supported classification;
   MY SST must not inherit SG recoverable Input Tax.
4. The production `tax_rule` configuration reference, source effective date,
   approver identity/role and review timestamp.
5. Boundary fixtures for standard, zero-rated, exempt, category-specific, pre/post
   transition and balanced posting cases.

Until then, keep the fail-closed resolver and generic MY row out of production tax
claims. This recheck narrows the review gap; it does not provide qualified approval.

## Verification boundary

- Official pages were opened and their relevant statements recorded on 2026-09-11.
- Source alignment was checked against `src/data/seed.ts`,
  `src/data/schema/localization.ts`, `src/modules/localization/tax.ts` and
  `src/modules/localization/tax.test.ts`.
- `npm test -- --run src/modules/localization/tax.test.ts` passed 1 file / 7 tests.
- GOAL's count/dependency/fingerprint validator passed with 240 registry rows
  (226 done / 6 in progress / 5 todo / 3 blocked), 27/48 criteria and 36/60
  checkpoints; no registry or acceptance count changed.
- `npm run docs:check` passed 78 Markdown files / 788 local links. The separate
  root `GOAL.md` / `PROGRESS.md` / `GOAL_PROMPT.md` review passed 83 local links;
  `git diff --check` passed.
- No production database, tenant mutation, migration or tax configuration update was
  attempted. No qualified tax-owner approval or statutory compliance claim is made.

## Effective-date ambiguity guard — 2026-09-11T10:53:46Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the existing 226-entry dirty
  worktree and separate TASK-236 candidate worktree were preserved. No production
  database, tenant record, tax configuration or migration was changed.
- **Expected:** `getEffectiveTaxRate()` must apply the inclusive
  `validFrom`/exclusive `validTo` interval and refuse an ambiguous document date
  when more than one Company-scoped rule matches the same tax code.
- **Root cause:** the lookup previously limited matching rows to one and silently
  selected the latest `validFrom`, so overlapping configuration could produce a
  plausible but unapproved rate.
- **Implementation:** the query now reads at most two matching rows, orders by
  `validFrom` and identity for stable inspection, and returns a rule only when
  exactly one row matches. Multiple matches return `null`; existing posting callers
  therefore fail closed through their existing missing/invalid-tax paths.
- **Actual:** `src/data/repo.test.ts` retains the mid-window, exact-boundary,
  exclusive-end, open-ended and no-match cases and now proves an overlapping 9%
  and 10% pair returns `null`. `src/modules/localization/tax.test.ts` continues
  to prove GST/SST classification and Decimal recovery behavior.
- **Verification:** `npm test -- --run src/data/repo.test.ts
  src/modules/localization/tax.test.ts --reporter=dot` passed **2 files / 16
  tests**. `npm run lint`, `npm run typecheck`, `npm run typecheck:web`,
  `npm run demo` and `npm run build:demo` passed; build warnings remain the
  existing classic-script, missing-static-asset, externalized Node module,
  browser-eval and chunk-size warnings.
- **PostgreSQL boundary:** `env -u POSTGRES_URL npm run test:postgres
  -- --reporter=dot` exited 0 with 3 skipped files/tests because no PostgreSQL
  target was configured. The shared Drizzle query remains the same contract for
  PostgreSQL, but no disposable or production PostgreSQL result is claimed here.
- **Acceptance delta / boundary:** effective-date ambiguity is now fail-closed in
  the shared repository path used by Demo/PGlite and PostgreSQL. Registry status,
  GOAL criteria and execution checkpoints remain unchanged. Qualified owner
  selection of authoritative SG/MY sources, production configuration, thresholds,
  exemptions, transitions and approval remains open; no statutory compliance claim
  is made.

## Purchasing fixture preserves ambiguity guard — 2026-09-11T15:02:29Z

### Expected result

The purchasing return regression must create one unambiguous Company-scoped `SR`
rule for its 2024 document fixtures while the shared resolver continues to reject
genuinely overlapping effective-dated rules.

### Root cause and repair

The full current-root Vitest run exposed a failure in
`src/modules/purchasing/purchaseReturn.test.ts`: the mismatch-source case calls the
fixture twice, and the fixture used an unqualified `onConflictDoNothing()` even
though `tax_rule` intentionally has no uniqueness constraint on `validFrom`. The
second identical row made the valid date ambiguous, so `getEffectiveTaxRate()`
correctly returned no rule and purchase-order creation failed before the intended
receipt/invoice mismatch assertion.

The fixture now looks up the existing row by tenant, regime, tax code and
`validFrom` before inserting the synthetic rule. Production schema, resolver
interval semantics, tenant scope, posting behavior and overlap fail-closed handling
are unchanged.

### Verification

- Initial full run: `npm test -- --reporter=dot` returned one failure in the
  purchase-return mismatch fixture (209 files passed, 3 skipped; 983 passed and
  3 skipped tests).
- After the repair: `npm test -- --run src/modules/purchasing --reporter=dot`
  passed 11 files / 60 tests; the focused repository/localization/purchase-return
  run passed 3 files / 22 tests.
- No production database, migration, tax configuration, provider, alert sink or
  secret was used. Registry, GOAL criteria and execution checkpoint counts remain
  unchanged pending the final full-suite recheck.

## Full current-root regression after fixture repair — 2026-09-11T15:24:24Z

The repaired fixture was rechecked against the complete current root rather than
only the affected package. `npm test -- --reporter=dot` passed **210 test files /
984 tests**, with **3 PostgreSQL-dependent files / 3 tests skipped** because no
PostgreSQL target was configured. The existing malformed-JSON and unsafe-locale
stderr lines remained expected security/i18n test output. No new failure was
observed, and no task, GOAL criterion or execution checkpoint count changed.

This is current-root local Vitest evidence. It does not provide qualified SG/MY
tax-owner approval, production tax configuration, real-provider, alerting,
deployment or Print acceptance.

## Final gates after fixture repair — 2026-09-11T15:26:21Z

- **Source identity:** root `main`, HEAD `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the
  existing dirty worktree and separate TASK-236/release worktrees were preserved.
- **Code gates:** `npm run lint`, `npm run typecheck`, `npm run typecheck:web`,
  `npm run demo` and `npm run build:demo` exited 0. Demo output preserved the
  purchase-return stock/GL rollback and balanced posting checks. Build output
  contains the existing classic-script, missing-static-CSS, externalized Node
  module, browser-eval and large-chunk warnings.
- **Regression:** the complete root Vitest run passed 210 files / 984 tests;
  `npm run test:postgres -- --reporter=dot` skipped 3 files / 3 tests because no
  PostgreSQL URL was configured.
- **Documentation gates:** `npm run docs:check` passed 79 Markdown files / 795
  local links; the GOAL validator passed 240 registry rows (226 done, 6 in
  progress, 5 todo, 3 blocked), 27/48 criteria and 36/60 checkpoints with no
  dependency-ready Todo; root Markdown review returned 8 files / 189 local
  links / 0 errors; `git diff --check` passed.
- **Boundary:** this repair only changes a test fixture. No generated schema or
  migration, production tax rule, tenant record, provider request, alert sink,
  deployment, push or secret was touched. Qualified tax-owner approval and
  production SG/MY configuration remain open.

## Disposable PostgreSQL parity after fixture repair — 2026-09-11T15:30:34Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the existing dirty worktree and
  separate TASK-236/release worktrees were preserved. The run used only the
  existing disposable `codex-erp-postgres-s5` PostgreSQL 16 container through
  the repository-documented local loopback URL. Production Compose containers
  and production data were not addressed.
- **Expected:** the three configured PostgreSQL integration files should execute
  against the disposable target and preserve the same tenant, transaction and
  fail-closed tax-fixture contract exercised by the Demo/PGlite suite.
- **Actual:** `POSTGRES_URL='postgres://postgres@127.0.0.1:55432/postgres'
  npm run test:postgres -- --reporter=dot` passed **3 test files / 3 tests** in
  12.22 seconds. No source, schema, migration or production configuration was
  changed by this verification.
- **Acceptance boundary:** this closes the local disposable PostgreSQL parity
  check for the fixture repair. It does not establish qualified SG/MY tax-owner
  approval, authoritative statutory source selection, production tax-rule
  configuration, real-provider OCR, alerting, deployment or human Print review.

## Company and regime isolation regression — 2026-09-11T15:59:51Z

- **Actor / custody:** Codex on root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; existing dirty paths and all
  separate candidate/release worktrees were preserved. This is a local PGlite
  fixture; no production tenant, tax configuration or secret was used.
- **Expected:** identical tax codes must remain isolated by the authenticated
  `masterFn` + `companyFn` scope, and the Company tax regime must select the
  matching GST or SST rule rather than leaking a same-code row from another
  Company or Master.
- **Implementation:** `src/data/repo.test.ts` now seeds one GST Company and
  one SST Company with the same `SR` code but different rates/classifications,
  then checks both scoped lookups and a foreign-Master lookup. No production
  resolver or schema change was required.
- **Actual:** the focused repository test passed **1 file / 10 tests**; the
  repository/localization/purchasing regression passed **4 files / 31 tests**.
  The complete current-root Vitest run then passed **210 files / 985 tests**,
  with **3 PostgreSQL-dependent files / 3 tests skipped** because the default
  environment did not provide a target. The existing disposable PostgreSQL
  gate remains separately verified at 3 files / 3 tests in the preceding record.
- **Acceptance boundary:** this strengthens local tenant/regime evidence and
  preserves Demo/PostgreSQL shared query behavior. It does not provide qualified
  tax-owner approval, production configuration, statutory compliance, provider,
  deployment or human Print acceptance.

## Final gates after Company/regime isolation regression — 2026-09-11T16:02:06Z

- **Source identity / custody:** root `main`, HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; 233 existing dirty paths and
  TASK-236/release worktrees remain preserved. The only code change in this
  increment is the tenant/regime regression in `src/data/repo.test.ts`.
- **Code verification:** `npm run lint`, `npm run typecheck`,
  `npm run typecheck:web`, `npm run demo` and `npm run build:demo` all exited 0.
  Demo preserved the existing PGlite purchasing, approval, rollback and balanced
  GL assertions. Build output contains only the existing classic-script,
  missing-static-CSS, externalized Node module, browser-eval and large-chunk
  warnings.
- **Regression and parity:** complete root Vitest passed 210 files / 985 tests,
  with 3 PostgreSQL-dependent files / 3 tests skipped under the default unset
  environment. The safe disposable PostgreSQL 16 run remains 3 files / 3 tests
  passed as recorded above.
- **Documentation gates:** `npm run docs:check` passed 79 Markdown files / 795
  local links; the GOAL count/dependency/fingerprint validator passed 240 rows
  (226 done, 6 in progress, 5 todo, 3 blocked), 27/48 criteria and 36/60
  checkpoints with no dependency-ready Todo; root Markdown review returned
  8 files / 191 local links / 0 errors; `git diff --check` passed.
- **Boundary:** no production database, tenant record, migration, generated
  schema, tax configuration, provider request, alert sink, deployment, push or
  secret was touched. Registry, GOAL criteria and execution checkpoint counts
  remain unchanged.
