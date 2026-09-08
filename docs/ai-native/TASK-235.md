# TASK-235 — Build permission-aware ERP semantics and knowledge retrieval

Goal: **G08** · Initial status: **Todo** · Priority: **P1**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-228, TASK-232**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G08 criteria plus common DoD remain required for task completion.

## Outcome and scope

Provide a small tenant-facing receipt/metric/SOP retrieval layer. The developer project KB is not a customer data store and cannot substitute for tenant document permissions.

## Read these existing files first

- [src/api/resources.ts](../../src/api/resources.ts)
- [src/modules/expenses/companyReceipt.ts](../../src/modules/expenses/companyReceipt.ts)
- [src/modules/reporting/analytics.ts](../../src/modules/reporting/analytics.ts)
- [src/modules/documents/access.ts](../../src/modules/documents/access.ts)
- [src/modules/documents/governance.ts](../../src/modules/documents/governance.ts)
- [src/auth/authorization.ts](../../src/auth/authorization.ts)
- [docs/PROJECT_LOGIC.md](../../docs/PROJECT_LOGIC.md)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

Start with receipt count and currency-separated receipt totals for an explicit date range. Define null-date, void, timezone, status and as-of semantics. Compute using deterministic authorized queries, not model arithmetic or unrestricted generated SQL.

## Execute in this order

- [ ] **S1 — Define the semantic contract.**

  Action: List supported questions, terms, field ownership and calculation rules. Use the existing command's date/visibility semantics. Keep SG/MY currencies separate; provide source IDs and query as-of time.

  Checkpoint exit: Golden fixtures give exact values for empty range, boundary dates, own/company scope and mixed currencies.

  Evidence: Not run.

- [ ] **S2 — Implement bounded factual reads.**

  Action: Expose selected metrics/entities through G01 schemas. Enforce live row/field scope before constructing model context. Bound pagination/query size; do not retrieve all tenants then filter in the model.

  Checkpoint exit: P02-P05/P09 pass and aggregate totals reconcile with the same authorized records.

  Evidence: Not run.

- [ ] **S3 — Implement scoped SOP retrieval.**

  Action: Select a small governed document corpus; retain version/effective date and access metadata. Apply authorization before retrieval content is returned; treat embedded instructions as data.

  Checkpoint exit: Protected or revoked documents never enter the model context or caller-visible snippets.

  Evidence: Not run.

- [ ] **S4 — Add citations and freshness rules.**

  Action: Return resolvable source references and policy dates; label unknown/conflicting evidence. Scope caches and memory by relevant actor/company/permission version and invalidate on revoke or source change.

  Checkpoint exit: P14 malicious content and stale/contradictory policy cases produce grounded answers or explicit uncertainty.

  Evidence: Not run.

- [ ] **S5 — Verify accuracy and isolation.**

  Action: Run underlying analytics/receipt/authorization tests plus new retrieval tests and common gates. Include cache warm/cold, Company switch, permission downgrade and inaccessible citation resolution.

  Checkpoint exit: G08 evidence reconciles numerical answers and proves non-disclosure through results, citations and caches.

  Evidence: Not run.

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G08.1:** Define owned metric/entity contracts including Company, time period, timezone, currency, status and source IDs; compute financial facts through deterministic ERP reads.
  - Required evidence: Versioned metric/entity definitions and golden values.
  - Current result: Not run.
- **G08.2:** Retrieve selected SOP/policy documents with tenant, record and field permissions checked before content reaches the model.
  - Required evidence: Pre-context tenant/row/field filtering.
  - Current result: Not run.
- **G08.3:** Return source links, record versions/as-of times and explicit unknown or conflicting evidence; distinguish transaction facts, policy and AI inference.
  - Required evidence: Citations, as-of dates and conflicting-evidence behavior.
  - Current result: Not run.
- **G08.4:** Prove inaccessible/expired documents, contradictory policies, Company switching and revoked access cannot leak data through retrieval, caches or Agent memory.
  - Required evidence: Revoked-document, cross-Company and cache/memory isolation tests.
  - Current result: Not run.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm test -- src/modules/reporting/analytics.test.ts src/modules/expenses/companyReceipt.test.ts src/auth/authorization.test.ts
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

Ambiguous business metric definitions or unresolved document ownership require an explicit recorded decision; do not invent rules or import the developer KB into tenant search.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
