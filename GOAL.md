# AI Native ERP System Goal

Reviewed: **2026-09-08**. Planning baseline: `d4c9dc9`.
Owner: product owner; engineering owns implementation and evidence.
Delivery programme: **EPIC-068 / TASK-227–240**.

Start execution with [AI_NATIVE_EXECUTION.md](docs/AI_NATIVE_EXECUTION.md) and the
selected [task packet](docs/AI_NATIVE_EXECUTION.md#recommended-sequence). The
[follow-up prompt](docs/AGENT_FOLLOWUP_PROMPT.md) provides a copyable handoff.
TASK-240 adds detailed instructions, not an AI capability.

Documentation verification: [TASK-240 evidence](docs/ai-native/evidence/TASK-240-2026-09-08.md).

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

- This file owns the target, milestone checklist, common Definition of Done (DoD),
  phase exits and dated progress snapshot.
- [tasks/tasks.jsonl](tasks/tasks.jsonl) owns task status and dependencies. G01–G12
  below mirror the corresponding task acceptance criteria; update both together.
- [docs/STATUS.md](docs/STATUS.md) owns built/mock/runtime status;
  [docs/SPEC.md](docs/SPEC.md) owns binding system invariants.
- [docs/ERP_QUALITY_BASELINE.md](docs/ERP_QUALITY_BASELINE.md) supplies cross-cutting
  workflow, UX, accessibility, localization, themes, market, scale and upgrade criteria.
- [docs/TEST_COVERAGE.md](docs/TEST_COVERAGE.md) and dated evidence records own test
  results. [docs/PROJECT_LOGIC.md](docs/PROJECT_LOGIC.md) and the
  `erp-system-project-logic` KB preserve source-backed continuity.
- This design establishes a delivery baseline, not a deployment authorization,
  provider purchase, compliance certification or runtime-completion claim.
- New functionality remains Todo until implemented and verified. A task awaiting
  dependencies is Todo; use Blocked only for a documented actual impediment.

## Progress count

Snapshot after TASK-240 execution-guide acceptance; recompute using the command below
whenever task status or a goal checkbox changes.

| Measure | Done | Remaining | Total |
| --- | ---: | ---: | ---: |
| All registered tasks | 220 | 20 | 240 |
| Inherited open delivery tasks at baseline | 0 | 8 | 8 |
| New AI Native delivery workstreams, TASK-228–239 | 0 | 12 | 12 |
| Goal DoD criteria, G01.1–G12.4 | 0 | 48 | 48 |
| Execution checkpoints, five per delivery packet | 0 | 60 | 60 |
| Goal documentation tasks, TASK-227 and TASK-240 | 2 | 0 | 2 |

Registry states: **220 Done / 4 In Progress / 13 Todo / 3 Blocked / 240 Total**.
Pending means every status other than Done: **8 inherited + 12 new = 20**.
The 12 new tasks contain **5 P0 / 7 P1** work packages. The 20 pending tasks contain
**8 P0 / 12 P1**. Priorities describe release risk; dependency order governs execution.

Historical registry completion is **91.7% (220/240)**. AI Native workstream acceptance
is **0% (0/12)** and criterion acceptance is **0% (0/48)**. These are unweighted
counts, not estimates of engineering effort, time remaining or overall product quality.
Existing ERP foundations receive no automatic credit for new Agent acceptance criteria.
Documentation tasks and execution checkpoints are excluded from AI capability
completion. The 60 checkpoints provide smaller progress units; they do not change
the 12-workstream or 48-criterion denominator. The prior TASK-227 baseline was
219 Done / 239 Total / 20 Pending; TASK-240 adds one completed documentation task.

### Inherited open work: counted once

| Task | Registry status | Remaining acceptance |
| --- | --- | --- |
| TASK-017 | Blocked | Physical-phone layout, PWA and business-flow evidence |
| TASK-193 | Blocked | Production SMTP and administrator recovery implementation/delivery proof |
| TASK-199 | In Progress | Production availability, exact revision, asset integrity and release evidence |
| TASK-201 | Todo | Measured query/scale budgets, monitoring, alerts and disaster recovery |
| TASK-202 | In Progress | Receipt Pack production download/Print and release acceptance |
| TASK-204 | In Progress | Qualified tax-owner review of production SG/MY configuration |
| TASK-205 | In Progress | Production Vision gateway, credential operations and recovery evidence |
| TASK-209 | Blocked | Platform tenant administration production release/security evidence |

TASK-239 consumes these outcomes; it does not duplicate or replace their task records.
Baseline statuses above are repository evidence, not a fresh production probe.

### Reproduce the count

Run from the repository root; this reads files only:

```bash
python3 - <<'PY'
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

## First vertical pilot and success measures

Pilot: **find Company Receipts -> inspect original evidence -> prepare Receipt Pack
-> confirm exact contents -> generate -> verify persisted Pack and artifact -> open result**.

- Reuse `src/modules/expenses/companyReceipt.ts`, `companyReceiptPack.ts`,
  `companyReceiptPackGovernance.ts` and `src/api/routes/companyReceipts.ts`.
- Direct Company Receipt/Pack operations remain Company-owned and do not require
  an Employee or create an Expense Claim, reimbursement, GL entry or tax filing.
  Upstream upload/capture remains the existing My Receipts employee workflow.
- Do not invent a preview API or approval capability: TASK-228/233 must define and
  implement the pilot preparation/confirmation contract where it is missing.
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
First new implementation task: TASK-228. TASK-232 is independently ready after TASK-227.
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
7. Update task acceptance, this checklist, STATUS/TEST_COVERAGE, domain documentation
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

All boxes below are open at the 2026-09-08 planning baseline. Each task now has
a detailed packet under docs/ai-native/ with S1–S5 execution checkpoints. Existing source
foundations are listed for reuse; they do not satisfy the complete new DoD.

### G01 — Publish governed ERP action contracts

**Task:** [TASK-228](docs/ai-native/TASK-228.md) · **Priority:** P0 · **Phase:** Foundation
**Dependencies:** TASK-227.
**Current evidence:** Existing resource and permission registries are foundations; a dedicated Agent action catalogue is absent.

- [ ] **G01.1** Publish versioned machine-readable action input/output schemas, permissions, prerequisites, side effects, bounded pagination and recoverable error codes from one maintained contract.
- [ ] **G01.2** Map pilot receipt reads and Pack preparation/execution to existing authenticated APIs and shared commands; do not expose raw SQL or client-selected tenant authority.
- [ ] **G01.3** Return authoritative resource IDs, versions and postconditions; prove idempotent replay and changed-payload conflict for applicable writes.
- [ ] **G01.4** Shared dispatcher tests and thin adapter contract fixtures prove one business-rule boundary; document supported and unsupported pilot actions. Real WebMCP and MCP interoperability is verified under TASK-229 and TASK-230.

### G02 — Expose the receipt pilot through WebMCP

**Task:** [TASK-229](docs/ai-native/TASK-229.md) · **Priority:** P1 · **Phase:** Pilot
**Dependencies:** TASK-228, TASK-232, TASK-233.
**Current evidence:** No WebMCP registration is established in current source.

- [ ] **G02.1** Register structured receipt search, authorized detail and Pack preparation/execution tools with feature detection and the ordinary UI retained when unsupported.
- [ ] **G02.2** Bind tools to live actor, Company and page state; revoke stale registrations/context on navigation, Company switch, logout and permission change.
- [ ] **G02.3** Keep draft edits, confirmation and execution state visible; prevent a tool from silently discarding unsaved work or bypassing server authorization.
- [ ] **G02.4** Browser tests exercise the real receipt journey, invalid input, cancellation and stale scope in supported WebMCP browsers plus the unsupported-browser fallback.

### G03 — Provide an authenticated ERP MCP server

**Task:** [TASK-230](docs/ai-native/TASK-230.md) · **Priority:** P1 · **Phase:** Pilot
**Dependencies:** TASK-228, TASK-232, TASK-233.
**Current evidence:** ERP APIs exist; a dedicated remote ERP MCP server is not established.

- [ ] **G03.1** Provide a versioned remote MCP endpoint with capability discovery and pilot tools backed by the governed action catalogue.
- [ ] **G03.2** Implement the selected MCP HTTP authorization profile, protected-resource discovery, audience validation, least-privilege scopes, expiry and revocation.
- [ ] **G03.3** Enforce tenant derivation and resource/field permissions on every call; bound result size, rate and execution time and preserve structured errors.
- [ ] **G03.4** Interoperability tests with two selected MCP clients prove receipt read/Pack execution, rejected cross-Company access, revoked tokens and safe timeout replay.

### G04 — Connect the ERP agent to approved external MCP tools

**Task:** [TASK-231](docs/ai-native/TASK-231.md) · **Priority:** P1 · **Phase:** Expansion
**Dependencies:** TASK-232, TASK-234.
**Current evidence:** Encrypted integration connectors exist; a general outbound MCP client is not established.

- [ ] **G04.1** Implement a Company-owned outbound MCP connection lifecycle with encrypted credentials, explicit authorization, health, pause and revocation.
- [ ] **G04.2** Allowlist destinations and approved tool versions; require review when tool definitions or requested scopes change and defend outbound requests against SSRF.
- [ ] **G04.3** Enforce field minimization and an explicit egress policy; treat remote tool content as untrusted data and require approval for external side effects.
- [ ] **G04.4** Prove one selected read-only document or calendar connector end to end, including malicious instructions, timeout, credential rotation and revoked-access denial.

### G05 — Establish least-privilege agent identity and delegation

**Task:** [TASK-232](docs/ai-native/TASK-232.md) · **Priority:** P0 · **Phase:** Foundation
**Dependencies:** TASK-227.
**Current evidence:** Human/session and Platform authorization exist; Agent-specific delegation is not established.

- [ ] **G05.1** Model distinct human, delegated Agent and service automation principals with an accountable owner and attributable audit identity.
- [ ] **G05.2** Intersect delegation grants with current tenant/module/resource/field permissions and explicit time, action and amount limits; never inherit shared administrator authority.
- [ ] **G05.3** Prove expiry, revocation, Company isolation and permission downgrade during a running task under non-superuser PostgreSQL/FORCE RLS.
- [ ] **G05.4** Provide administrator review, credential rotation and emergency disable controls; preserve existing Platform/Master/Company ownership boundaries.

### G06 — Bind agent execution to approval and business evidence

**Task:** [TASK-233](docs/ai-native/TASK-233.md) · **Priority:** P0 · **Phase:** Foundation
**Dependencies:** TASK-228, TASK-232.
**Current evidence:** Domain approvals, version checks and idempotency exist; Agent-wide policy binding is not established.

- [ ] **G06.1** Define server-enforced action classes for read, draft, confirmed execution and approval-required execution; reuse existing business approval authority.
- [ ] **G06.2** Bind confirmation/approval to actor, Company, exact payload digest, resource version and expiry; changed facts invalidate approval.
- [ ] **G06.3** Prove cancel, reject, stale version, concurrent execution and timeout replay cause no unauthorized or duplicate side effect; preserve segregation of duties.
- [ ] **G06.4** Show the resulting document/version and before/after business impact; route corrections of governed records through existing reversal or append-only mechanisms.

### G07 — Deliver the server AI runtime and contextual ERP workspace

**Task:** [TASK-234](docs/ai-native/TASK-234.md) · **Priority:** P1 · **Phase:** Pilot
**Dependencies:** TASK-230.
**Current evidence:** Governed document OCR/Vision exists; wizard AI selection is preview-only and no general ERP assistant exists.

- [ ] **G07.1** Implement a server-owned provider interface and Company configuration with encrypted secrets, allowed models, data policy, bounded timeout and per-run cost/call budgets.
- [ ] **G07.2** Provide contextual chat, cited receipt results, Pack preview and confirmation, with distinct draft, waiting, running, succeeded, failed and cancelled states.
- [ ] **G07.3** Complete the real receipt-to-Pack journey using governed tools and verified database/artifact postconditions; the assistant cannot announce success from model prose alone.
- [ ] **G07.4** Prove provider failure/cancellation and zero credential leakage; test en/ms/zh/ja/vi, light/dark, desktop/mobile and accessible focus/keyboard behavior.

### G08 — Build permission-aware ERP semantics and knowledge retrieval

**Task:** [TASK-235](docs/ai-native/TASK-235.md) · **Priority:** P1 · **Phase:** Expansion
**Dependencies:** TASK-228, TASK-232.
**Current evidence:** ERP facts and a developer project KB exist; a tenant-facing semantic retrieval layer is not established.

- [ ] **G08.1** Define owned metric/entity contracts including Company, time period, timezone, currency, status and source IDs; compute financial facts through deterministic ERP reads.
- [ ] **G08.2** Retrieve selected SOP/policy documents with tenant, record and field permissions checked before content reaches the model.
- [ ] **G08.3** Return source links, record versions/as-of times and explicit unknown or conflicting evidence; distinguish transaction facts, policy and AI inference.
- [ ] **G08.4** Prove inaccessible/expired documents, contradictory policies, Company switching and revoked access cannot leak data through retrieval, caches or Agent memory.

### G09 — Run durable and recoverable agent workflows

**Task:** [TASK-236](docs/ai-native/TASK-236.md) · **Priority:** P1 · **Phase:** Expansion
**Dependencies:** TASK-230, TASK-234.
**Current evidence:** Workers/outbox exist; durable multi-step Agent runs are not established.

- [ ] **G09.1** Persist run/step state, actor scope, approved intent, leases, checkpoints and bounded retry metadata so authorized work survives browser closure and worker restart.
- [ ] **G09.2** Support pause, resume, cancellation and approval waiting; recheck permissions and approval validity before every resumed side effect.
- [ ] **G09.3** Use transactional events/outbox and idempotent consumers for selected event triggers; document compensation and manual recovery for cross-system failures.
- [ ] **G09.4** Failure-injection tests cover duplicate delivery, expired leases, partial execution, restart and budget exhaustion without duplicate posting or false completion.

### G10 — Establish agent safety evaluations and audit observability

**Task:** [TASK-237](docs/ai-native/TASK-237.md) · **Priority:** P0 · **Phase:** Expansion
**Dependencies:** TASK-229, TASK-230, TASK-231, TASK-234, TASK-235, TASK-236.
**Current evidence:** Domain/API/browser tests and audit records exist; no dedicated Agent evaluation release gate is established.

- [ ] **G10.1** Version a receipt-pilot evaluation set with happy paths, invalid input, prompt injection, unauthorized data access, stale approval, revocation and retry scenarios.
- [ ] **G10.2** Require every deterministic authorization/transaction invariant to pass and zero false-success results; achieve at least 95 percent verified success in each of three recorded runs, each containing at least 30 valid pilot cases.
- [ ] **G10.3** Record redacted run/model/tool versions, correlation IDs, approvals, resource postconditions, latency and full retry cost; never log secrets or unnecessary sensitive payloads.
- [ ] **G10.4** Gate model/prompt/tool changes on the same evaluations, record environment and evidence artifacts, and exercise a failed rollout plus emergency disable.

### G11 — Close the selected ERP business journeys and market acceptance gaps

**Task:** [TASK-238](docs/ai-native/TASK-238.md) · **Priority:** P1 · **Phase:** Expansion
**Dependencies:** TASK-227.
**Current evidence:** Canonical routes and partial workflows exist; all-module E2E and complete SG/MY statutory support are not proven.

- [ ] **G11.1** Publish an owner-reviewed capability matrix for order-to-cash, procure-to-pay, record-to-report, inventory, HR/leave/payroll and receipt/evidence flows with explicit exclusions.
- [ ] **G11.2** Define and implement the approved v1 settlement scope, including ordinary sales receipt allocation and partial-payment behavior, with stock/AR/AP/GL reconciliation and reversal tests.
- [ ] **G11.3** Record per-client SG/MY applicability and required statutory/e-invoice outputs; any claimed integration must pass sandbox submission, rejection/correction/cancellation and status reconciliation plus owner approval.
- [ ] **G11.4** Demonstrate each included release journey through real UI and authenticated APIs with permission, duplicate, stale-version and failure rollback coverage; register excluded later scope explicitly.

### G12 — Release and operate the AI Native ERP safely

**Task:** [TASK-239](docs/ai-native/TASK-239.md) · **Priority:** P0 · **Phase:** Release
**Dependencies:** TASK-017, TASK-193, TASK-199, TASK-201, TASK-202, TASK-204, TASK-205, TASK-209, TASK-229, TASK-230, TASK-231, TASK-232, TASK-233, TASK-234, TASK-235, TASK-236, TASK-237, TASK-238.
**Current evidence:** Deployment/PWA/worker foundations exist; eight inherited release gates and new Agent operations remain open.

- [ ] **G12.1** Close the eight inherited open tasks with their own evidence and pass G01-G11; verify exact production web/API revision, asset hashes and current release CI without reset/reseed.
- [ ] **G12.2** Exercise Company-level enablement, protocol/tool/API compatibility, staged rollout, rollback and emergency disable while preserving in-flight work and browser drafts across updates.
- [ ] **G12.3** Measure declared latency/cost/concurrency budgets, alerts and recovery objectives on representative production data; verify retention, backup restore and incident ownership for Agent runs and connectors.
- [ ] **G12.4** Ship a labelled deterministic offline Demo/replay with no production secrets and a real authorized production pilot; record owner acceptance, limitations and operational handover.

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

## Progress maintenance and planning evidence

- TASK-227 and TASK-240 are documentation milestones only; their completion adds
  no checked AI box. G01.4 was clarified under TASK-240: use thin adapter fixtures
  for the shared contract now; real WebMCP/MCP interoperability remains mandatory
  under G02/G03. G10.2 now states the 95% threshold separately for each of three
  runs. Neither clarification removes a goal criterion.
- Maintain one unique task ID per work package. Preserve all pre-existing task rows.
  Split work only by appending linked tasks and recording the change in this goal.
- Recompute counts after status changes and synchronize the current snapshots in
  TASK, STATUS, PENDING_TASK_BREAKDOWN, TEST_COVERAGE and RELEASE_CHECKLIST.
- Validation for the planning milestone: `npm run docs:check`, the count command
  above, dependency-cycle/acceptance-mapping checks, rendered Markdown/local-link
  inspection and `git diff --check`. No runtime, live provider or production
  acceptance is claimed by this documentation update.

Historical TASK-227 planning acceptance recorded on 2026-09-08: all 226 original task rows were
preserved byte-for-byte; 239 task IDs are unique and dependencies are acyclic;
the 12 workstreams match all 48 task acceptance strings. The existing docs checker
passes 42 Markdown files / 283 local links. Because that checker scans README/docs,
root GOAL.md was separately rendered and inspected: 25 headings, 3 tables, 48
unchecked boxes and valid local link targets. The embedded count command and final
diff check pass. The goal KB item was written and read back as
`24435a44-ca84-4794-a242-3d10bae8a7ab`; the existing AI-boundary item and KB summary
were synchronized. Full runtime tests were not rerun for this documentation-only change.
