# Tax Owner Review Packet — 2026-09-07

This packet prepares the qualified tax-owner review required by TASK-204. It is
source evidence and a decision checklist, not tax advice, a filing determination or
production approval.

## Current source mapping

The current demo seed and tax resolver provide the following explicit facts:

| Company | Current source fact | Effective interval | Accounting default | Evidence |
| --- | --- | --- | --- | --- |
| C-SG | `GST` / `gst_standard` / `8%` | `[2023-01-01, 2024-01-01)` | `100%` input-tax recovery | `src/data/seed.ts`, `src/modules/localization/tax.ts` |
| C-SG | `GST` / `gst_standard` / `9%` | `[2024-01-01, ∞)` | `100%` input-tax recovery | `src/data/seed.ts`, `src/modules/localization/tax.ts` |
| C-MY | `SST` / `sst_service` / `8%` | `[2025-07-01, ∞)` | `0%` input-tax recovery | `src/data/seed.ts`, `src/modules/localization/tax.ts` |

All transaction lookups use the documented `[valid_from, valid_to)` interval and
posting fails closed for an unclassified or regime-incompatible rule. The Malaysia
`0%` recoverability value is the current application default; it must be approved as
an accounting policy rather than inferred as a complete statutory SST engine.

## Official source observations

- [IRAS current GST rates](https://www.iras.gov.sg/taxes/goods-services-tax-%28gst%29/basics-of-gst/current-gst-rates)
  states that Singapore's current GST rate is 9%, subject to zero-rated and exempt
  supplies.
- [IRAS GST transitional rules](https://www.iras.gov.sg/taxes/goods-services-tax-%28gst%29/gst-rate-change/gst-rate-change-for-business/transitional-rules-for-gst-rate-change)
  records the 8% to 9% change from 1 January 2024 and transitional treatment for
  supplies spanning a rate change. The owner must confirm whether the ERP's document
  date is sufficient for every supported transaction type.
- [MySST service-tax FAQ](https://mysst.customs.gov.my/faq-services-tax/) states a
  general 8% service-tax rate, with 6% exceptions including F&B, logistics,
  telecommunications and parking, plus specific card-service treatment.
- [MySST background](https://mysst.customs.gov.my/background/) describes additional
  service categories and records category-specific rates and effective dates,
  including rental/leasing and construction.
- [Malaysia MOF SST policy update (5 January 2026)](https://mof.gov.my/portal/images/2026/01/05/Siaran-Media-Pemakluman-Dasar-Dikemaskini-Berhubung-Cukai-Jualan-Dan-Cukai-Perkhidmatan-SST.pdf)
  records 2026 changes including a rental/leasing rate reduction to 6%, revised
  thresholds and construction-contract transitional treatment.

These sources show why the seeded generic `sst_service` row is a bounded demo fact,
not sufficient evidence for production MY SST coverage.

## Decisions required before TASK-204 can be Done

The qualified tax owner must attach an approval record covering:

1. Supported SG GST and MY SST classifications, including the category-specific rate
   and exception taxonomy.
2. Registration thresholds, exemptions, transitional rules, supply/payment/document
   date precedence and credit/debit-note correction behavior.
3. Input-tax recoverability and account mapping for every supported classification,
   including the explicit policy for non-recoverable SST.
4. Effective dates, source URLs, source effective dates, approver identity and review
   timestamps for each production `tax_rule` and policy snapshot.
5. Regression fixtures for boundary dates, zero/exempt/standard cases, applicable
   exceptions and balanced GL postings.

Until those decisions are approved and recorded, retain the fail-closed resolver,
keep the generic MY rule out of production claims, and leave TASK-204 `In Progress`.

## Verification boundary

Verified 2026-09-07 against the current source and official pages above. This packet
does not claim a tax-owner approval, production configuration review or filing
compliance.
