# Localization — Singapore & Malaysia

2026-09-07 acceptance note: governed tax source hardening is present; tax-owner
production approval remains TASK-204. TASK-216 repairs the compact seed and showcase
upgrade with explicit SG/MY tax snapshots; the posting guard still rejects incomplete
or regime-incompatible records. UI date-only handling is repaired under TASK-217; invoice
aging and fiscal-period KPI presentation is repaired under TASK-218. Translation gaps
remain TASK-219.
See [TEST_COVERAGE.md](TEST_COVERAGE.md).

The ERP serves multiple countries from one codebase. Country behavior is an **attribute
of the company (`company_fn`)**, not a build flag. Today: **Singapore (SG)** and
**Malaysia (MY)**. The design must let a third country be added without touching existing
companies.

Current implementation boundary (2026-09-06): Company country/currency and
effective-dated tenant `tax_rule` rows are implemented. TASK-204 source hardening now
uses one `[valid_from, valid_to)` interval, explicit tax classification and recoverability
facts, and versioned source/review metadata. The separate `GstEngine`/`SstEngine` classes
and statutory GST F5/SST-02/MyInvois/InvoiceNow outputs described below remain target
design, not completed filing integrations.

The source-level TASK-204 boundary is implemented, but production release still requires
a qualified tax owner to review configured rates, exemptions, thresholds and transitional
rules against current official orders. Local tests and seeded source URLs are not filing
compliance or production-approval evidence.

## 1. Per-company localization config

Each company carries:

| Field | SG example | MY example |
| --- | --- | --- |
| `country` | `SG` | `MY` |
| `currency` | `SGD` | `MYR` |
| `tax_regime` | `GST` | `SST` |
| `locale` | `en` | `en` / `ms` |
| `fiscal_year_start` | nullable configuration; required before go-live | nullable configuration; required before go-live |

`tax_rule` also stores `tax_classification`, `input_tax_recoverable_pct`, `source_url`,
`source_effective_date`, `approved_by_user_id` and `reviewed_at`. Legacy imported rows may
remain `unclassified`, but transaction posting rejects that value instead of inferring
mechanics from a tax-code string.

Multi-currency is implemented per domain, not universally: Expense Claims snapshot
original/functional currency and policy/actual FX facts, and consolidation has its own
rate model. A transaction table must not be assumed to carry document currency/FX unless
its schema and command prove it.

## 2. Tax is a pluggable MODEL, not a rate field

> The single most important localization rule: **SG GST and MY SST are different tax
> *mechanics*, not two numbers.** Modeling tax as a single `rate` column will not work.

| | Singapore GST | Malaysia SST |
| --- | --- | --- |
| Type | VAT-style, multi-stage | Single-stage |
| Input tax credit | **Yes** (claim GST on purchases) | **No** credit mechanism |
| Current rate model | **9% standard GST** (IRAS, reviewed 2026-09-06) | Classification- and effective-date-dependent; official MySST currently includes 6%, 8% and specific-rate cases |
| Charged | On most sales of goods & services | Sales tax at manufacture/import; service tax on prescribed services |
| Return | Output − input GST | Tax collected, no offset |

Official sources reviewed 2026-09-06: [IRAS current GST rates](https://www.iras.gov.sg/taxes/goods-services-tax-%28gst%29/basics-of-gst/current-gst-rates),
[Royal Malaysian Customs MySST background](https://mysst.customs.gov.my/background/)
and [Malaysia MOF 5 January 2026 policy update](https://mof.gov.my/portal/ms/berita/siaran-media/pemakluman-dasar-dikemaskini-berhubung-cukai-jualan-dan-cukai-perkhidmatan).
Rates, exemptions and transitional rules are time-sensitive. Production configuration
requires tax-owner review against the applicable official order; this page is not tax
advice.

Because the mechanics differ, the target tax layer is a **strategy per `tax_regime`**:

```
TaxEngine
  ├── GstEngine   (SG)  → output tax + input tax credit, GST return
  └── SstEngine   (MY)  → sales/service tax, no input credit
```

In the target, each document line resolves tax through its Company's regime strategy.
Adding a country means adding an engine plus configuration and conformance tests rather
than editing every module. Current source performs tenant/tax-code/date lookup and
dispatches posting treatment through `src/modules/localization/tax.ts`: GST
standard/zero-rated/exempt and explicit SST classifications are validated; SST is
non-recoverable by default, and positive SST recovery is accepted only for explicit
`sst_deductible` configuration. The full strategy classes and statutory filing outputs
remain future work.

## 3. Tax rules are effective-dated — never a constant

Rates change and scopes expand over time:

- SG GST: 7% → 8% (2023) → **9% (2024)**.
- MY SST scope expanded from **1 Jul 2025** and was amended again in 2026; applicable
  classification, rate, threshold, exemption and transition must come from versioned
  official configuration rather than this narrative.

So a tax rule **must** carry validity dates, and a transaction uses the rate valid on its
**document date**, not "today":

```sql
tax_rule (
  id, company_fn, tax_regime, tax_code,
  rate numeric(6,3),
  tax_classification, input_tax_recoverable_pct,
  valid_from date NOT NULL,
  valid_to   date NULL,         -- exclusive; open-ended until superseded
  source_url, source_effective_date, approved_by_user_id, reviewed_at
)
-- pick: WHERE company_fn=$1 AND tax_code=$2
--         AND doc_date >= valid_from AND (valid_to IS NULL OR doc_date < valid_to)
```

This makes historical documents reproducible (an invoice from 2023 keeps 8% GST) and
future rate changes a data insert, not a code change.

The same exclusive interval applies to `expense_policy_version`. Expense policy snapshots
retain the resolved tax classification so a later posting cannot silently revive a legacy
generic Input Tax mapping. `tax_rule` source facts are configuration evidence; they do not
replace the required tax-owner review before production release.

## 4. Compliance artifacts (per country, later phases)

Not built now, but the data model must not preclude them:

- **SG:** GST F5 return figures; IRAS InvoiceNow / Peppol e-invoicing direction.
- **MY:** SST-02 return; **MyInvois / LHDN e-invoicing** (e-invoice mandate rollout).

Document numbering, tax breakdown storage, and the audit log are designed so these
reports can be generated from existing data.

The Company locale is a short language code and is not yet a complete statutory-document
locale engine. It does **not** select the browser UI language. The current Web UI maps
its independent `localStorage("aria-lang")` preference to browser locales; see
[I18N.md](I18N.md).

## 5. What stays country-neutral

The core (orders, stock, ledger structure, multi-tenancy) is country-neutral. Only these
are localized: **currency, tax engine, tax rules, locale/formatting, statutory reports,
document number formats.** Keep localization at the edges; never fork a core module per
country.

## 6. Demo mode

The checked-in Demo seed contains one master with **two companies — one SG (GST), one MY
(SST)** — so fresh local Demo data exercises multi-country rate lookup. This source fact
does not prove the currently public deployment is healthy or tax-engine complete.
