# Localization — Singapore & Malaysia

The ERP serves multiple countries from one codebase. Country behavior is an **attribute
of the company (`company_fn`)**, not a build flag. Today: **Singapore (SG)** and
**Malaysia (MY)**. The design must let a third country be added without touching existing
companies.

## 1. Per-company localization config

Each company carries:

| Field | SG example | MY example |
| --- | --- | --- |
| `country` | `SG` | `MY` |
| `currency` | `SGD` | `MYR` |
| `tax_regime` | `GST` | `SST` |
| `locale` | `en-SG` | `en-MY` / `ms-MY` |
| `fiscal_year_start` | configurable | configurable |

Multi-currency: transactions store the **company currency** plus, where relevant, the
**document currency + FX rate** so cross-border and group consolidation work.

## 2. Tax is a pluggable MODEL, not a rate field

> The single most important localization rule: **SG GST and MY SST are different tax
> *mechanics*, not two numbers.** Modeling tax as a single `rate` column will not work.

| | Singapore GST | Malaysia SST |
| --- | --- | --- |
| Type | VAT-style, multi-stage | Single-stage |
| Input tax credit | **Yes** (claim GST on purchases) | **No** credit mechanism |
| Current rate | **9%** (IRAS) | Sales tax **5% / 10%**; Service tax **6% / 8%** |
| Charged | On most sales of goods & services | Sales tax at manufacture/import; service tax on prescribed services |
| Return | Output − input GST | Tax collected, no offset |

Sources: [IRAS GST](https://www.iras.gov.sg/quick-links/tax-rates/goods-and-services-tax-(gst)-rates),
Malaysia SST (scope expanded 1 Jul 2025).

Because the mechanics differ, the tax layer is a **strategy per `tax_regime`**:

```
TaxEngine
  ├── GstEngine   (SG)  → output tax + input tax credit, GST return
  └── SstEngine   (MY)  → sales/service tax, no input credit
```

Each document line resolves its tax through its company's engine. Adding a country = add
an engine + config, not edit every module.

## 3. Tax rules are effective-dated — never a constant

Rates change and scopes expand over time:

- SG GST: 7% → 8% (2023) → **9% (2024)**.
- MY SST: sales/service scope **expanded 1 Jul 2025** (new services: leasing, construction,
  financial, healthcare, education, beauty).

So a tax rule **must** carry validity dates, and a transaction uses the rate valid on its
**document date**, not "today":

```sql
tax_rule (
  id, company_fn, tax_regime, tax_code,
  rate numeric(6,3),
  valid_from date NOT NULL,
  valid_to   date NULL          -- open-ended until superseded
)
-- pick: WHERE company_fn=$1 AND tax_code=$2
--         AND doc_date >= valid_from AND (valid_to IS NULL OR doc_date < valid_to)
```

This makes historical documents reproducible (an invoice from 2023 keeps 8% GST) and
future rate changes a data insert, not a code change.

## 4. Compliance artifacts (per country, later phases)

Not built now, but the data model must not preclude them:

- **SG:** GST F5 return figures; IRAS InvoiceNow / Peppol e-invoicing direction.
- **MY:** SST-02 return; **MyInvois / LHDN e-invoicing** (e-invoice mandate rollout).

Document numbering, tax breakdown storage, and the audit log are designed so these
reports can be generated from existing data.

The company `locale` above controls company-authored documents, statutory output and
country presentation rules. It does **not** select the browser UI language. The current
Web UI stores its independent language preference in `localStorage("aria-lang")`; see
[I18N.md](I18N.md).

## 5. What stays country-neutral

The core (orders, stock, ledger structure, multi-tenancy) is country-neutral. Only these
are localized: **currency, tax engine, tax rules, locale/formatting, statutory reports,
document number formats.** Keep localization at the edges; never fork a core module per
country.

## 6. Demo mode

The demo seeds one master with **two companies — one SG (GST), one MY (SST)** — so the
public demo actually shows multi-country, multi-tax behavior, not a single-country toy.
