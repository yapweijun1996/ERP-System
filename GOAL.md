# AI Native ERP System Goal

Reviewed: **2026-09-11**. Programme: **EPIC-068 / TASK-227–240**.
Product owner owns scope and business acceptance; engineering owns implementation
and reproducible technical evidence. Named owners and dates must be assigned, not inferred.

Read [PROGRESS.md](PROGRESS.md) for the current board and next measurable outcome.
Use [GOAL_PROMPT.md](GOAL_PROMPT.md) to continue work. This file owns stable outcomes,
acceptance criteria and the common Definition of Done; it is not a chronological log.

## Product goal

Deliver a modular ERP for Singapore and Malaysia in which people and authorized AI
agents complete real business workflows through the same governed business commands.
Users can inspect facts, prepare work, approve meaningful changes and verify results
through the web UI, browser WebMCP tools, remote MCP clients or the built-in assistant.

AI interprets intent and coordinates work. The ERP owns authorization, tenant scope,
calculations, approvals, transactions and authoritative records. An AI statement is
not proof of a completed business operation.

Serve Company administrators, finance/procurement teams and employees, with separately
authorized external assistants and background automation. Keep Platform administration
separate from tenant business authority. Preserve a usable static Demo and a secure,
operable PostgreSQL production system.

## Scope and evidence ownership

| Record | Responsibility |
| --- | --- |
| [GOAL.md](GOAL.md) | Product outcome, phase exits, G01–G12 acceptance and common DoD |
| [PROGRESS.md](PROGRESS.md) | Dated projection of current work, blockers, evidence scope, next exits and ideas |
| [GOAL_PROMPT.md](GOAL_PROMPT.md) | Repeatable continuation and update procedure |
| [Task registry](tasks/tasks.jsonl) | Unique task IDs, status, priority, dependencies and acceptance text |
| [Execution packets](docs/AI_NATIVE_EXECUTION.md) | S1–S5 implementation steps and detailed testing procedure |
| [STATUS](docs/STATUS.md) / [SPEC](docs/SPEC.md) | Built/mock/runtime truth / binding cross-cutting invariants |
| [PROJECT_LOGIC](docs/PROJECT_LOGIC.md) / project KB | Source-backed domain contracts / cross-session continuity |
| [Quality baseline](docs/ERP_QUALITY_BASELINE.md) / [TEST_COVERAGE](docs/TEST_COVERAGE.md) | Product acceptance framework / scoped test evidence |

Current code and tests resolve implementation disagreements. GOAL criterion text
must exactly match the mapped task acceptance. PROGRESS is a checked projection,
not a second task registry. Packet checkmarks measure execution steps, not product
acceptance. A documentation update, fixture or successful deployment cannot by
itself establish a real business outcome or statutory compliance.

Scope changes need an explicit reason, affected task/criterion IDs, owner decision
and dated baseline. Do not delete difficult criteria or add bookkeeping tasks to
improve the apparent completion rate. TASK-227/240 contribute no AI capability.

## First vertical pilot and success measures

Pilot: **find Company Receipts -> inspect original evidence -> prepare Receipt Pack
-> confirm exact contents -> generate -> verify persisted Pack and artifact -> open result**.

- Reuse `src/modules/expenses/companyReceipt.ts`, `companyReceiptPack.ts`,
  `companyReceiptPackGovernance.ts` and `src/api/routes/companyReceipts.ts`.
- Direct Company Receipt/Pack operations remain Company-owned and do not require
  an Employee or create an Expense Claim, reimbursement, GL entry or tax filing.
  Upstream upload/capture remains the existing My Receipts employee workflow.
- Reuse the governed preparation/confirmation contracts delivered by TASK-228/233;
  verify their current callers before extending them.
- Complete the same intent via remote MCP and WebMCP, then through the built-in
  assistant. Read-only and draft stages may be developed locally before production.
- Verify persisted identity/version, selected evidence, generated artifact and
  authorized download. A successful model response or a route render is insufficient.
- Release targets: 100% pass for deterministic authorization, tenant, approval and
  transaction invariants; zero false-success results; at least 95% verified success
  over at least 30 valid pilot cases in each of three recorded evaluation runs.
- Record completion time, user corrections, p95 latency, calls and cost per successful
  run against a manual baseline. TASK-237/239 must fix numerical latency/cost/capacity
  budgets with owners before release; no current measured budget or ROI is claimed.
- Include en/ms/zh/ja/vi, light/dark themes and desktop/mobile in the UI acceptance
  matrix. Physical-phone proof is independently required by TASK-017.

## Architecture and boundaries

```text
Web UI / WebMCP page tools / remote MCP clients / built-in assistant
  -> transport adapter + authenticated principal/delegation
  -> governed action contract + current authorization + approval policy
  -> existing domain commands / transactional database / audit and outbox
  -> verified resource and artifact postconditions

Built-in assistant -> approved external MCP client -> external service
                      (separate credentials, egress policy and side-effect approval)
```

- One business contract, multiple adapters. Keep domain commands in `src/modules/`;
  derive tenant context and enforce API authorization in `src/api/` and `src/auth/`.
- Existing `src/api/resources.ts` and permission definitions are starting points,
  not permission to expose every internal function as an Agent tool.
- WebMCP is a page/session interaction surface. Remote MCP is an authenticated
  server interface. Outbound MCP connects ERP to other services. None is a substitute
  for the others or a reason to bypass ERP permissions.
- Preserve the vanilla-JavaScript `SCREENS` frontend and Demo/API adapter contract.
  Implement server-mediated model access; never publish provider credentials.
- Monetary/tax/stock decisions remain deterministic. Reject unsupported or ambiguous
  business actions rather than generating SQL or silently selecting another Company.
- Do not introduce a separate business database, generic administrator Agent,
  unrestricted autonomous payments, self-approved Agent changes or an Agent marketplace
  in the pilot. Multi-agent orchestration is not a prerequisite for v1.
- Full statutory engines, every ERP module and every external connector are not
  promised by pilot acceptance. G11 must declare the selected release scope and
  applicability; excluded capability cannot be marketed as implemented.

## Delivery phases and exits

| Phase | Work | Exit evidence |
| --- | --- | --- |
| 0: Definition | TASK-227, TASK-240 | Goal, counted checklist, registered dependencies, docs and KB verified |
| 1: Foundation | G01, G05, G06 | Governed action/identity/approval contracts and adversarial tests |
| 2: Receipt pilot | G03, G02, G07 | Same real receipt-to-Pack intent through MCP, WebMCP and assistant |
| 3: Expansion | G04, G08, G09, G10, G11 | Approved external connector, grounded reads, durable runs, evaluations and selected business closure |
| 4: Release | G12 plus inherited gates | Exact deployed evidence, accepted pilot, operations, recovery and handover |

Independent foundation work may proceed while production access is unavailable.
TASK-199 remains the existing production priority and TASK-204 the tax-owner gate.
The original foundation entry tasks TASK-228 and TASK-232 are complete locally.
Current phase status and continuation are recorded in PROGRESS.md.
Dependencies in the registry govern execution even when a lower-numbered task waits.

## Common Definition of Done

Every workstream requires its four checklist criteria **and** all applicable rules below:

1. Implement the actual user outcome through the shared domain contract; preserve
   tenant isolation, module authority, financial invariants and existing behavior.
2. Record positive and negative evidence with source revision, environment, actor
   class/Company scope, action, expected/actual result and evidence location.
3. For code changes, pass the applicable `CLAUDE.md` gates: zero-warning lint,
   both typechecks, PGlite Demo proof/build, affected desktop/375px browser flows
   with zero console errors, and focused/regression tests. Run schema/permission/
   generated checks when affected and PostgreSQL/RLS/concurrency proofs where required.
4. Distinguish local source, Demo, test fixture, real provider, remote CI, physical
   device and production evidence. No category substitutes for another.
5. Verify errors, cancellation, expired/revoked access, stale state and retries.
   Approvals bind exact intent; confirmed results bind actual persisted postconditions.
6. Document known limits, data retention, migration/rollback and operational ownership
   where affected. Pass the applicable ERP quality baseline, including accessibility,
   localization, both themes and safe client updates.
7. Update task acceptance, this checklist, PROGRESS, STATUS/TEST_COVERAGE, domain documentation
   and relevant KB together. Add a dated evidence link immediately below each checked
   criterion. Do not check a box merely because code exists or a plan was written.
8. Documentation-only work requires JSONL/count/dependency validation, local-link and
   Markdown-render review, `git diff --check`, and KB read-back. It does not certify
   runtime behavior.

All four goal boxes, the five packet checkpoints and the common DoD must pass
before marking that workstream Done.
Keep partially verified criteria checked only with evidence; the workstream stays open.
A scope change must explain the denominator change and preserve a dated baseline,
rather than deleting difficult criteria to improve completion percentage.

## Goal checklist

The 48 criteria below map to TASK-228–239. Evidence scope and current task status
are summarized in PROGRESS; a checked criterion never certifies an entire release.

### G01 — Publish governed ERP action contracts

**Task:** [TASK-228](docs/ai-native/TASK-228.md) · **Priority:** P0 · **Phase:** Foundation
**Dependencies:** TASK-227.

- [x] **G01.1** Publish versioned machine-readable action input/output schemas, permissions, prerequisites, side effects, bounded pagination and recoverable error codes from one maintained contract.
  - Evidence: [TASK-228 dated S5 evidence](docs/ai-native/evidence/TASK-228-2026-09-08.md#s5-boundary-publication-and-final-verification).
- [x] **G01.2** Map pilot receipt reads and Pack preparation/execution to existing authenticated APIs and shared commands; do not expose raw SQL or client-selected tenant authority.
  - Evidence: [TASK-228 dated S5 evidence](docs/ai-native/evidence/TASK-228-2026-09-08.md#s5-boundary-publication-and-final-verification).
- [x] **G01.3** Return authoritative resource IDs, versions and postconditions; prove idempotent replay and changed-payload conflict for applicable writes.
  - Evidence: [TASK-228 dated S4 evidence](docs/ai-native/evidence/TASK-228-2026-09-08.md#s4-replay-and-adapter-compatibility).
- [x] **G01.4** Shared dispatcher tests and thin adapter contract fixtures prove one business-rule boundary; document supported and unsupported pilot actions. Real WebMCP and MCP interoperability is verified under TASK-229 and TASK-230.
  - Evidence: [TASK-228 dated S5 evidence](docs/ai-native/evidence/TASK-228-2026-09-08.md#s5-boundary-publication-and-final-verification).

### G02 — Expose the receipt pilot through WebMCP

**Task:** [TASK-229](docs/ai-native/TASK-229.md) · **Priority:** P1 · **Phase:** Pilot
**Dependencies:** TASK-228, TASK-232, TASK-233.

- [x] **G02.1** Register structured receipt search, authorized detail and Pack preparation/execution tools with feature detection and the ordinary UI retained when unsupported.
  - Evidence: [TASK-229 native WebMCP evidence](docs/ai-native/evidence/TASK-229-2026-09-09.md#s5--run-browser-regressions-and-close-the-local-checkpoint).
- [x] **G02.2** Bind tools to live actor, Company and page state; revoke stale registrations/context on navigation, Company switch, logout and permission change.
  - Evidence: [TASK-229 native WebMCP evidence](docs/ai-native/evidence/TASK-229-2026-09-09.md#s5--run-browser-regressions-and-close-the-local-checkpoint).
- [x] **G02.3** Keep draft edits, confirmation and execution state visible; prevent a tool from silently discarding unsaved work or bypassing server authorization.
  - Evidence: [TASK-229 native WebMCP evidence](docs/ai-native/evidence/TASK-229-2026-09-09.md#s5--run-browser-regressions-and-close-the-local-checkpoint).
- [x] **G02.4** Browser tests exercise the real receipt journey, invalid input, cancellation and stale scope in supported WebMCP browsers plus the unsupported-browser fallback.
  - Evidence: [TASK-229 native WebMCP evidence](docs/ai-native/evidence/TASK-229-2026-09-09.md#s5--run-browser-regressions-and-close-the-local-checkpoint).

### G03 — Provide an authenticated ERP MCP server

**Task:** [TASK-230](docs/ai-native/TASK-230.md) · **Priority:** P1 · **Phase:** Pilot
**Dependencies:** TASK-228, TASK-232, TASK-233.

- [x] **G03.1** Provide a versioned remote MCP endpoint with capability discovery and pilot tools backed by the governed action catalogue.
  - Evidence: [TASK-230 S5 evidence](docs/ai-native/evidence/TASK-230-2026-09-09.md#goal-dod-status-after-s5).
- [x] **G03.2** Implement the selected MCP HTTP authorization profile, protected-resource discovery, audience validation, least-privilege scopes, expiry and revocation.
  - Evidence: [TASK-230 S5 evidence](docs/ai-native/evidence/TASK-230-2026-09-09.md#goal-dod-status-after-s5).
- [x] **G03.3** Enforce tenant derivation and resource/field permissions on every call; bound result size, rate and execution time and preserve structured errors.
  - Evidence: [TASK-230 S5 evidence](docs/ai-native/evidence/TASK-230-2026-09-09.md#goal-dod-status-after-s5).
- [x] **G03.4** Interoperability tests with two selected MCP clients prove receipt read/Pack execution, rejected cross-Company access, revoked tokens and safe timeout replay.
  - Evidence: [TASK-230 S5 evidence](docs/ai-native/evidence/TASK-230-2026-09-09.md#goal-dod-status-after-s5).

### G04 — Connect the ERP agent to approved external MCP tools

**Task:** [TASK-231](docs/ai-native/TASK-231.md) · **Priority:** P1 · **Phase:** Expansion
**Dependencies:** TASK-232, TASK-234.

- [ ] **G04.1** Implement a Company-owned outbound MCP connection lifecycle with encrypted credentials, explicit authorization, health, pause and revocation.
- [ ] **G04.2** Allowlist destinations and approved tool versions; require review when tool definitions or requested scopes change and defend outbound requests against SSRF.
- [ ] **G04.3** Enforce field minimization and an explicit egress policy; treat remote tool content as untrusted data and require approval for external side effects.
- [ ] **G04.4** Prove one selected read-only document or calendar connector end to end, including malicious instructions, timeout, credential rotation and revoked-access denial.

### G05 — Establish least-privilege agent identity and delegation

**Task:** [TASK-232](docs/ai-native/TASK-232.md) · **Priority:** P0 · **Phase:** Foundation
**Dependencies:** TASK-227.

- [x] **G05.1** Model distinct human, delegated Agent and service automation principals with an accountable owner and attributable audit identity.
  - Evidence: [TASK-232 S1–S5 evidence](docs/ai-native/evidence/TASK-232-2026-09-09.md#s5-database-isolation-and-close).
- [x] **G05.2** Intersect delegation grants with current tenant/module/resource/field permissions and explicit time, action and amount limits; never inherit shared administrator authority.
  - Evidence: [TASK-232 grant and lifecycle evidence](docs/ai-native/evidence/TASK-232-2026-09-09.md#s2-grants-and-validation).
- [x] **G05.3** Prove expiry, revocation, Company isolation and permission downgrade during a running task under non-superuser PostgreSQL/FORCE RLS.
  - Evidence: [TASK-232 PostgreSQL evidence](docs/ai-native/evidence/TASK-232-2026-09-09.md#s5-database-isolation-and-close).
- [x] **G05.4** Provide administrator review, credential rotation and emergency disable controls; preserve existing Platform/Master/Company ownership boundaries.
  - Evidence: [TASK-232 lifecycle evidence](docs/ai-native/evidence/TASK-232-2026-09-09.md#s4-lifecycle-controls).

### G06 — Bind agent execution to approval and business evidence

**Task:** [TASK-233](docs/ai-native/TASK-233.md) · **Priority:** P0 · **Phase:** Foundation
**Dependencies:** TASK-228, TASK-232.

- [x] **G06.1** Define server-enforced action classes for read, draft, confirmed execution and approval-required execution; reuse existing business approval authority.
  - Evidence: [TASK-233 S5 evidence](docs/ai-native/evidence/TASK-233-2026-09-09.md#s5--verify-all-negative-paths).
- [x] **G06.2** Bind confirmation/approval to actor, Company, exact payload digest, resource version and expiry; changed facts invalidate approval.
  - Evidence: [TASK-233 S5 evidence](docs/ai-native/evidence/TASK-233-2026-09-09.md#s5--verify-all-negative-paths).
- [x] **G06.3** Prove cancel, reject, stale version, concurrent execution and timeout replay cause no unauthorized or duplicate side effect; preserve segregation of duties.
  - Evidence: [TASK-233 S5 evidence](docs/ai-native/evidence/TASK-233-2026-09-09.md#s5--verify-all-negative-paths).
- [x] **G06.4** Show the resulting document/version and before/after business impact; route corrections of governed records through existing reversal or append-only mechanisms.
  - Evidence: [TASK-233 S5 evidence](docs/ai-native/evidence/TASK-233-2026-09-09.md#s5--verify-all-negative-paths).

### G07 — Deliver the server AI runtime and contextual ERP workspace

**Task:** [TASK-234](docs/ai-native/TASK-234.md) · **Priority:** P1 · **Phase:** Pilot
**Dependencies:** TASK-230.

- [x] **G07.1** Implement a server-owned provider interface and Company configuration with encrypted secrets, allowed models, data policy, bounded timeout and per-run cost/call budgets.
  - Evidence: [TASK-234/S1-S2 evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s2--implement-secret-safe-server-configuration).
- [x] **G07.2** Provide contextual chat, cited receipt results, Pack preview and confirmation, with distinct draft, waiting, running, succeeded, failed and cancelled states.
  - Evidence: [TASK-234/S3-S4 evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s4--build-the-contextual-workspace).
- [ ] **G07.3** Complete the real receipt-to-Pack journey using governed tools and verified database/artifact postconditions; the assistant cannot announce success from model prose alone.
  - Partial evidence only; reopened 2026-09-11 pending the real server/provider and receipt journey. See [acceptance correction](PROGRESS.md#acceptance-correction) and [TASK-234/S3-S4 governed execution evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s4--build-the-contextual-workspace).
- [x] **G07.4** Prove provider failure/cancellation and zero credential leakage; test en/ms/zh/ja/vi, light/dark, desktop/mobile and accessible focus/keyboard behavior.
  - Evidence: [TASK-234/S4-S5 failure, locale, theme and accessibility evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s5--validate-fixture-and-real-model-journeys). The later [TASK-232 locale remediation](docs/ai-native/evidence/TASK-232-2026-09-09.md#post-s5-agent-governance-locale-remediation--2026-09-09) closes the separate global i18n follow-up; provider, production and physical-device evidence remain separate.

2026-09-11 supporting exit: the user authorized the existing Demo endpoint and
Codex OCR/review without a user-operated step. The [observed Demo run and upload
repair](docs/ai-native/evidence/TASK-234-2026-09-11-codex-demo.md) verify one
readable synthetic receipt and one persisted Pack/PDF after reload. G07.3's separate
server/provider scope is not promoted by this narrower evidence; no manual user
review is pending for the approved Demo run.

### G08 — Build permission-aware ERP semantics and knowledge retrieval

**Task:** [TASK-235](docs/ai-native/TASK-235.md) · **Priority:** P1 · **Phase:** Expansion
**Dependencies:** TASK-228, TASK-232.

- [x] **G08.1** Define owned metric/entity contracts including Company, time period, timezone, currency, status and source IDs; compute financial facts through deterministic ERP reads.
  - Evidence: [TASK-235/S1 contract](docs/ai-native/evidence/TASK-235-2026-09-09.md#s1--define-the-semantic-contract) · [TASK-235/S2 bounded read](docs/ai-native/evidence/TASK-235-2026-09-09.md#s2--implement-bounded-factual-reads).
- [x] **G08.2** Retrieve selected SOP/policy documents with tenant, record and field permissions checked before content reaches the model.
  - Evidence: [TASK-235/S3 scoped SOP retrieval](docs/ai-native/evidence/TASK-235-2026-09-09.md#s3--implement-scoped-sop-retrieval).
- [x] **G08.3** Return source links, record versions/as-of times and explicit unknown or conflicting evidence; distinguish transaction facts, policy and AI inference.
  - Evidence: [TASK-235/S4 citations and freshness](docs/ai-native/evidence/TASK-235-2026-09-09.md#s4--add-citations-and-freshness-rules).
- [x] **G08.4** Prove inaccessible/expired documents, contradictory policies, Company switching and revoked access cannot leak data through retrieval, caches or Agent memory.
  - Evidence: [TASK-235/S5 accuracy and isolation](docs/ai-native/evidence/TASK-235-2026-09-09.md#s5--verify-accuracy-and-isolation).

### G09 — Run durable and recoverable agent workflows

**Task:** [TASK-236](docs/ai-native/TASK-236.md) · **Priority:** P1 · **Phase:** Expansion
**Dependencies:** TASK-230, TASK-234.

- [ ] **G09.1** Persist run/step state, actor scope, approved intent, leases, checkpoints and bounded retry metadata so authorized work survives browser closure and worker restart.
- [ ] **G09.2** Support pause, resume, cancellation and approval waiting; recheck permissions and approval validity before every resumed side effect.
- [ ] **G09.3** Use transactional events/outbox and idempotent consumers for selected event triggers; document compensation and manual recovery for cross-system failures.
- [ ] **G09.4** Failure-injection tests cover duplicate delivery, expired leases, partial execution, restart and budget exhaustion without duplicate posting or false completion.

### G10 — Establish agent safety evaluations and audit observability

**Task:** [TASK-237](docs/ai-native/TASK-237.md) · **Priority:** P0 · **Phase:** Expansion
**Dependencies:** TASK-229, TASK-230, TASK-231, TASK-234, TASK-235, TASK-236.

- [ ] **G10.1** Version a receipt-pilot evaluation set with happy paths, invalid input, prompt injection, unauthorized data access, stale approval, revocation and retry scenarios.
- [ ] **G10.2** Require every deterministic authorization/transaction invariant to pass and zero false-success results; achieve at least 95 percent verified success in each of three recorded runs, each containing at least 30 valid pilot cases.
- [ ] **G10.3** Record redacted run/model/tool versions, correlation IDs, approvals, resource postconditions, latency and full retry cost; never log secrets or unnecessary sensitive payloads.
- [ ] **G10.4** Gate model/prompt/tool changes on the same evaluations, record environment and evidence artifacts, and exercise a failed rollout plus emergency disable.

### G11 — Close the selected ERP business journeys and market acceptance gaps

**Task:** [TASK-238](docs/ai-native/TASK-238.md) · **Priority:** P1 · **Phase:** Expansion
**Dependencies:** TASK-227.

- [ ] **G11.1** Publish an owner-reviewed capability matrix for order-to-cash, procure-to-pay, record-to-report, inventory, HR/leave/payroll and receipt/evidence flows with explicit exclusions.
  - Evidence: [TASK-238/S1 source-backed matrix](docs/ai-native/evidence/TASK-238-2026-09-09.md#cross-module-capability-matrix); owner review remains pending.
- [ ] **G11.2** Define and implement the approved v1 settlement scope, including ordinary sales receipt allocation and partial-payment behavior, with stock/AR/AP/GL reconciliation and reversal tests.
- [ ] **G11.3** Record per-client SG/MY applicability and required statutory/e-invoice outputs; any claimed integration must pass sandbox submission, rejection/correction/cancellation and status reconciliation plus owner approval.
- [ ] **G11.4** Demonstrate each included release journey through real UI and authenticated APIs with permission, duplicate, stale-version and failure rollback coverage; register excluded later scope explicitly.

### G12 — Release and operate the AI Native ERP safely

**Task:** [TASK-239](docs/ai-native/TASK-239.md) · **Priority:** P0 · **Phase:** Release
**Dependencies:** TASK-017, TASK-193, TASK-199, TASK-201, TASK-202, TASK-204, TASK-205, TASK-209, TASK-229, TASK-230, TASK-231, TASK-232, TASK-233, TASK-234, TASK-235, TASK-236, TASK-237, TASK-238.

- [ ] **G12.1** Close the eight inherited open tasks with their own evidence and pass G01-G11; verify exact production web/API revision, asset hashes and current release CI without reset/reseed.
- [ ] **G12.2** Exercise Company-level enablement, protocol/tool/API compatibility, staged rollout, rollback and emergency disable while preserving in-flight work and browser drafts across updates.
- [ ] **G12.3** Measure declared latency/cost/concurrency budgets, alerts and recovery objectives on representative production data; verify retention, backup restore and incident ownership for Agent runs and connectors.
- [ ] **G12.4** Ship a labelled deterministic offline Demo/replay with no production secrets and a real authorized production pilot; record owner acceptance, limitations and operational handover.

## Progress count

Keep historical task closure, AI workstream acceptance, criterion acceptance and
execution checkpoints separate. Do not average them into product readiness.

### Reproduce the count

Run from the repository root with Python 3; this reads files only. A changed registry
fingerprint requires reviewing and refreshing PROGRESS, even if totals are unchanged.
A passing check proves consistency, not the truth of linked runtime evidence:

```bash
python3 - <<'PY'
import hashlib
import collections
import json
import re
from pathlib import Path

rows = [json.loads(line) for line in Path("tasks/tasks.jsonl").read_text().splitlines() if line.strip()]
by_id = {row["id"]: row for row in rows}
assert len(by_id) == len(rows), "Duplicate task IDs"
assert all(row["status"] in {"todo", "in_progress", "done", "blocked"} for row in rows)
counts = collections.Counter(row["status"] for row in rows)
inherited = ["TASK-017", "TASK-193", "TASK-199", "TASK-201", "TASK-202", "TASK-204", "TASK-205", "TASK-209"]
delivery = [f"TASK-{number}" for number in range(228, 240)]
criteria = re.findall(r"^- \[([ x])\] \*\*(G\d{2}\.\d)\*\* (.+)$", Path("GOAL.md").read_text(), re.M)
assert len(criteria) == 48 and len({key for _, key, _ in criteria}) == 48
progress = Path("PROGRESS.md").read_text()
checkpoints = []
for number in range(228, 240):
    task_id = f"TASK-{number}"
    prefix = f"G{number - 227:02d}."
    goal_items = [(mark, key, text) for mark, key, text in criteria if key.startswith(prefix)]
    assert [text for _, _, text in goal_items] == by_id[task_id]["acceptance"], task_id
    packet = Path(f"docs/ai-native/{task_id}.md").read_text()
    steps = re.findall(r"^- \[([ x])\] \*\*S([1-5]) —", packet, re.M)
    assert len(steps) == 5 and {key for _, key in steps} == set("12345"), task_id
    checkpoints.extend(steps)
    accepted = sum(mark == "x" for mark, _, _ in goal_items)
    completed = sum(mark == "x" for mark, _ in steps)
    expected = f"| G{number - 227:02d} | {task_id} | {by_id[task_id]['status']} | {accepted}/4 | {completed}/5 |"
    assert expected in progress, f"Stale workstream row: {task_id}"
    if by_id[task_id]["status"] == "done":
        assert all(mark == "x" for mark, _, _ in goal_items), task_id
        assert all(mark == "x" for mark, _ in steps), task_id
seen, active = set(), set()
def visit(key):
    assert key in by_id, f"Missing dependency: {key}"
    assert key not in active, f"Dependency cycle: {key}"
    if key in seen:
        return
    active.add(key)
    for dep in by_id[key].get("depends_on", []):
        visit(dep)
    active.remove(key)
    seen.add(key)
for key in by_id:
    visit(key)
expected_metrics = {
    "Registry tasks": len(rows), "Done": counts["done"],
    "In progress": counts["in_progress"], "Todo": counts["todo"],
    "Blocked": counts["blocked"], "Open tasks": len(rows) - counts["done"],
    "AI workstreams accepted": sum(by_id[key]["status"] == "done" for key in delivery),
    "Goal criteria accepted": sum(mark == "x" for mark, _, _ in criteria),
    "Execution checkpoints": sum(mark == "x" for mark, _ in checkpoints),
}
for label, value in expected_metrics.items():
    assert f"| {label} | {value} |" in progress, f"Stale metric: {label}"
assert hashlib.sha256(Path("tasks/tasks.jsonl").read_bytes()).hexdigest() in progress, "Stale registry fingerprint"
open_rows = re.findall(r"^\| (TASK-\d{3}) \| (todo|in_progress|blocked) \|", progress, re.M)
expected_open = {(row["id"], row["status"]) for row in rows if row["status"] != "done"}
assert len(open_rows) == len(expected_open) and set(open_rows) == expected_open, "Open-task ledger drift"
print("PROGRESS projection, acceptance mapping and dependency graph: PASS")
print("Registry:", dict(counts), "Total:", len(rows), "Pending:", len(rows) - counts["done"])
print("Inherited open:", sum(by_id[key]["status"] != "done" for key in inherited))
print("AI workstreams done:", sum(by_id[key]["status"] == "done" for key in delivery), "/ 12")
print("Goal criteria done:", sum(mark == "x" for mark, _, _ in criteria), "/ 48")
print("Execution checkpoints done:", sum(mark == "x" for mark, _ in checkpoints), "/ 60")
print("Documentation:", {key: by_id[key]["status"] for key in ["TASK-227", "TASK-240"]})
print("Dependency-ready Todo:", [row["id"] for row in rows if row["status"] == "todo"
      and all(by_id[dep]["status"] == "done" for dep in row.get("depends_on", []))])
PY
```

## Protocol references and compatibility policy

Reviewed during planning on 2026-09-08. Pin the protocol/browser/client versions
actually tested at implementation and release; recheck changes before upgrading.

- [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp):
  proposed standard with browser-based tool discovery and progressive enhancement;
  do not assume universal browser or unattended-server availability.
- [MCP HTTP authorization, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization):
  use an explicit tested authorization profile for the protected ERP server.
- [MCP security practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices):
  inform token handling, destination controls and untrusted integration boundaries.
