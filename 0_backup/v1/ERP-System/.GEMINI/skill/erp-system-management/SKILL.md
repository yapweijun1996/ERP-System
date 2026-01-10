---
name: erp-system-management
description: "Operate and improve an ERP system with a senior ERP manager workflow: manage environments and releases, roles/permissions, integrations, master data, reporting, performance, security, backups/DR, incident response, and change management."
version: "1.0"
tags: [workflow, sop, backend, docs, testing]
---

# Goal
Run an ERP system safely and predictably: stable operations, controlled change, reliable integrations and data quality, measurable performance, and a clear operating model for incidents, releases, and audits.

# When to Use
- You own ERP operations (NetSuite/SAP/Odoo/Dynamics/custom) and need a repeatable SOP for run + change.
- You’re onboarding as an ERP system manager and need a checklist to stabilize and improve.
- You’re planning a release, migration, integration, or reporting initiative that touches core business data.

# Inputs
- ERP platform and topology: vendor/product, modules in scope (finance, inventory, procurement, CRM), cloud/on-prem, environments (dev/test/prod).
- Stakeholders and processes: finance ops, supply chain, sales ops, HR, IT/security; critical business cycles (month-end, payroll, peak sales).
- Integrations map: upstream/downstream systems (payments, ecommerce, WMS, payroll, BI), interface types (API, SFTP, EDI), owners.
- Data model realities: master data domains (customers, vendors, items, chart of accounts), data ownership, validation rules.
- Constraints:
  - Default to **least privilege** and auditable changes.
  - Do not store credentials/secrets in docs; reference your secret manager.
  - Avoid production-impacting changes during close/peak windows unless explicitly approved.

# Output
- An operating playbook covering:
  - Environment and release process (with freeze windows)
  - Role/permission model and access reviews
  - Integration monitoring and failure handling
  - Master data governance and data quality checks
  - Reporting governance (source of truth, definitions, reconciliations)
  - Backup/DR plan and restore verification
  - Incident response and postmortem template
  - A prioritized improvement backlog (risk, impact, effort)

# Procedure
1. Establish the operating baseline (first 1–2 weeks).
   - Inventory modules, customizations, workflows, scheduled jobs, and critical reports.
   - Map the business calendar: close cycles, cutoffs, peak hours, blackout windows.
   - Identify “tier-1” processes (order-to-cash, procure-to-pay, record-to-report).
2. Define environments and change control.
   - Confirm dev/test/prod parity expectations and what can differ (data, integrations).
   - Set release cadence and change windows; define code/config freeze before close.
   - Require a change record for prod changes (what, why, owner, rollback plan).
3. Access management (security + audit).
   - Define role-based access by job function; enforce least privilege.
   - Establish joiner/mover/leaver process and quarterly access reviews.
   - Ensure elevated/admin access is limited, time-bound where possible, and logged.
4. Integration reliability.
   - Create an integrations register: endpoint, auth method, payload, schedule, retries, owner, runbook.
   - Implement monitoring: success/failure counters, latency, queue depth, and alerting.
   - Define reprocessing rules (idempotency keys, dedupe strategy, replay windows).
5. Master data governance (the “quiet source of outages”).
   - Assign data owners per domain (customer, vendor, item, COA).
   - Standardize required fields, naming conventions, and validation rules.
   - Add regular data quality checks (duplicates, missing required fields, invalid statuses).
6. Transaction integrity and reconciliations.
   - Define daily/weekly reconciliations between ERP and key systems (payments, bank, ecommerce, WMS).
   - During close, run controlled reconciliations with clear sign-off owners.
7. Reporting governance.
   - Define “single source of truth” metrics and their definitions (GMV, revenue, COGS, margin).
   - Version and review critical reports; document filters and calculation logic.
   - Validate key reports against reconciled data (spot checks + automated checks where possible).
8. Performance and stability.
   - Identify slow transactions/reports; capture baseline timings and peak patterns.
   - Tune within constraints (indexing/config if applicable, report optimization, batch scheduling).
   - Avoid expensive jobs during peak business hours; schedule heavy tasks off-peak.
9. Backups, DR, and change safety.
   - Confirm backup scope and retention (DB, attachments, configs, integration configs).
   - Define RPO/RTO targets and the DR procedure.
   - Test restore regularly (tabletop + periodic real restore in non-prod).
10. Incident response and communications.
   - Define severity levels, on-call/escalation paths, and comms channels.
   - Create runbooks for top failure modes (integration down, login outage, posting failures, batch job stuck).
   - After incidents: perform a blameless postmortem with concrete follow-ups.
11. Release execution checklist (every release).
   - Pre-release: validate in test, confirm change window, backups/rollbacks ready, stakeholders notified.
   - Release: apply change, verify smoke tests, monitor integrations/jobs.
   - Post-release: confirm business process health, reconcile key metrics, close change record.
12. Continuous improvement (what 20 years teaches).
   - Keep a risk register (security, data, integrations, close process) and review monthly.
   - Prioritize improvements by risk reduction and business impact, not novelty.
   - Automate repetitive checks first (integration health, data quality, reconciliations).

# Verification (Acceptance Checks)
- [ ] Environments and a change-control/release cadence exist with defined freeze windows.
- [ ] Roles/permissions follow least privilege and access reviews are scheduled.
- [ ] Integrations have an owner, monitoring, alerts, and a runbook with replay strategy.
- [ ] Master data governance exists (owners, validation rules, recurring quality checks).
- [ ] Backup/DR plan includes RPO/RTO and a tested restore procedure.
- [ ] Incident process exists (severity, escalation, comms) and postmortems create tracked actions.

# Failure Modes & Recovery
- **If month-end close is repeatedly unstable**: enforce a close freeze window → reduce concurrent changes → add reconciliation checklists → run tabletop close rehearsals.
- **If integrations frequently fail**: add monitoring/alerting → implement idempotency + replay → tighten schema validation and error handling → improve runbooks.
- **If data quality erodes**: assign data owners → add required-field validation → add weekly duplicate/missing checks → fix upstream entry points.
- **If access/audit issues appear**: tighten RBAC → remove shared accounts → implement periodic access reviews → ensure admin actions are logged.
- **If missing info**: ask user “Which ERP platform/modules are in scope, what are the critical business cycles (close/peak), and what integrations are most important?”

# Examples
## Example A
**User request:** “We keep having order posting failures between ecommerce and ERP.”
**What you do:** Build integrations register → identify failure modes → add monitoring + alerts → define idempotency and replay → create runbook and incident severity → add reconciliation report.
**Result:** A stable integration with clear ownership, fast detection, and safe replay.

## Example B
**User request:** “Close takes too long and numbers don’t reconcile.”
**What you do:** Define close freeze window → map close steps and owners → add daily/weekly reconciliations → validate report definitions → optimize heavy jobs off-peak → postmortem recurring issues.
**Result:** A predictable close process with reconciled metrics and fewer surprises.

# Notes (optional)
- Treat ERP changes like production changes: small, auditable, reversible.
- Master data and integrations cause most “mysterious” ERP incidents—monitor and govern them early.
