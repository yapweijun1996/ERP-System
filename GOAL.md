# AI Native ERP System Goal

Reviewed: **2026-09-11**. Planning baseline: `d4c9dc9`.
Owner: product owner; engineering owns implementation and evidence.
Delivery programme: **EPIC-068 / TASK-227–240**.

Latest production renderer checkpoint — **2026-09-11**: application release
`03487b13ce838407d97cd00697bd2b54b4a7c918` is healthy across API, Web,
calendar-worker and PostgreSQL, with API health matching Web `release.json`. The
application-only release recreated all application containers and preserved the
database without migration or reset. The Receipt Pack renderer now preserves
governed source bytes and writes a readable identity page for PNG/JPEG sources below
2×2 pixels. Final SG/MY artifacts are structurally verified two-page A4 PDFs; their
source rows remain synthetic 68-byte 1×1 PNGs, so readable-source replacement and
human visual/business acceptance remain open. Public `/erp/health` is still HTTP 502
until the prepared system Tunnel route is activated.

Production Receipt-to-Pack pilot baseline — **2026-09-10**: a fresh local production PostgreSQL
environment now runs coherent API/Web revision
`9ec8c0e5c1361dfe77c8a3e8cdca4730e0b56e05` with new SG/MY Companies and no imported
old data. Real employee sessions completed clean-evidence inspection, manual
metadata confirmation, Receipt creation, exact selection preview, immutable Pack
persistence/readback and PDF export for both countries. ClamAV marked both source
versions clean. Public Tunnel activation, production OCR readiness, human visual
PDF review and a live assistant-provider run remain open; see the
[dated evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#production-receipt-to-pack-pilot--2026-09-10).

Hosted Demo checkpoint — **2026-09-11**: Pages manifest
`e2e24f4f61259f58cd412eebb85e2fac75c5db6a` is live from workflow
`34519668605`; its application assets come from code release
`ae7a3cfabde0e03a704d943dc1d99cc3bb672e2a`. A fresh public-origin browser
context completed Setup Wizard with `expenses_tax`, confirmed a synthetic
Company Receipt, called the real Demo gateway, required visible confirmation
and read back one persisted Pack/PDF. This closes the deployed Demo UI/gateway
protocol slice only; production OCR/provider, public Tunnel and human acceptance
of a real receipt remain open.

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

## Current delivery goal in one page

**Overall outcome:** a usable SG/MY ERP where people and authorized AI complete
real business workflows through the same permission, approval, transaction and
audit rules. A user must be able to verify the resulting record and evidence.

**Current milestone:** finish Phase 2, the Company Receipt-to-Pack pilot. A user
asks for receipts, reviews cited evidence and exact Pack contents, explicitly
confirms creation, and opens the verified persisted Pack/PDF. Prove this through
the built-in assistant as well as the already locally evidenced MCP/WebMCP paths.
The pilot is the first complete delivery slice, not the whole ERP product scope.

**Where we are:** the shared commands, Agent identity, confirmation, MCP/WebMCP,
semantic reads and local assistant fixtures are evidenced. The local production
Receipt-to-Pack path is now also evidenced for SG/MY through authenticated employee
sessions, persisted Receipt/Pack rows and independently hashed PDFs. Phase 2 remains open:
TASK-234 now has a local Responses adapter, authenticated Company configuration
resolver and default-deny server bootstrap. A repeatable SG/MY local pilot runner
now verifies exact confirmation and reopened database/PDF persistence. Injected HTTP fixture evidence does
not prove a real-model run; approved account/model/data-policy/spend and separate
production/business-owner gates remain mandatory.

**Primary execution focus:** TASK-234, close the public Tunnel/OCR/visual-review
gates and verify the connected assistant runtime when account, data policy and cost
authority are available. A saved credential alone cannot activate the assistant. Preserve
cancellation and unknown-cost custody. Keep live AI acceptance open until its own
persisted Pack/PDF and sanitized provider usage evidence exists.

**After that:** TASK-236 (durable runs), TASK-231 (approved outbound connector),
TASK-237 (evaluations), selected TASK-238 business acceptance and TASK-239 release,
in registry dependency order. TASK-199 may take production priority when origin
access makes it actionable. Tax, SMTP, physical-device and other inherited gates
are supporting delivery work; they must not silently replace the pilot milestone.

**Progress rule:** report the milestone outcome, newly verified evidence, exact
remaining gap and next action. Use the counts below as separate indicators; 94.2%
historical task closure is not 94.2% product or production readiness. New plans,
reworded documentation and repeated tests do not increase capability completion.

See [the active execution plan](docs/GOAL_EXECUTION_PLAN.md) for the current
checkpoint, source-backed gaps and continuation rules.

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

Snapshot after TASK-238/S2 decision draft and the post-S5 UI/route/i18n remediation; recompute using the command below
whenever task status or a goal checkbox changes.

| Measure | Done | Remaining | Total |
| --- | ---: | ---: | ---: |
| All registered tasks | 226 | 14 | 240 |
| Inherited open delivery tasks at baseline | 0 | 8 | 8 |
| New AI Native delivery workstreams, TASK-228–239 | 6 | 6 | 12 |
| Goal DoD criteria, G01.1–G12.4 | 28 | 20 | 48 |
| Execution checkpoints, five per delivery packet | 36 | 24 | 60 |
| Goal documentation tasks, TASK-227 and TASK-240 | 2 | 0 | 2 |

Registry states: **226 Done / 6 In Progress / 5 Todo / 3 Blocked / 240 Total**.
Pending means every status other than Done: **8 inherited + 6 new = 14**.
The 12 new tasks contain **5 P0 / 7 P1** work packages. The 14 pending tasks contain
**5 P0 / 9 P1**. Priorities describe release risk; dependency order governs execution.

Historical registry completion is **94.2% (226/240)**. AI Native workstream acceptance
is **50.0% (6/12)** and criterion acceptance is **58.3% (28/48)**. These are unweighted
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
The original foundation entry tasks TASK-228 and TASK-232 are complete locally.
Current Phase 2 continuation is TASK-234; follow the active execution plan.
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

All boxes below were open at the 2026-09-08 planning baseline. G01, G02, G05 and G06 are
now accepted; the remaining tasks stay open. Each task now has
a detailed packet under docs/ai-native/ with S1–S5 execution checkpoints. Existing source
foundations are listed for reuse; they do not satisfy the complete new DoD.

### G01 — Publish governed ERP action contracts

**Task:** [TASK-228](docs/ai-native/TASK-228.md) · **Priority:** P0 · **Phase:** Foundation
**Dependencies:** TASK-227.
**Current evidence:** TASK-228 publishes the version-1 six-action catalogue, authenticated dispatcher, read-only Pack preparation and replay/adapter evidence; Agent identity/approval and the real MCP/WebMCP transports are verified under TASK-232/233/230/229, with production/provider boundaries kept downstream.

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
**Current evidence:** TASK-229/S1 verifies the three completed prerequisites and the current W3C/Chrome WebMCP surface. S2 implements a feature-detected six-tool page adapter with live actor/Company/permission fingerprints, lifecycle retirement and shared API/Demo receipt detail and Pack-preparation boundaries. S3 adds a visible review with selected evidence, exact totals, filters and pending action; cancellation is no-write and confirmation rechecks the selection digest before the existing session-authorized Pack writer. S4 exercises the fallback's invalid input, denied Company switch, live permission revocation/recovery, changed-selection retry and desktop/375px flow. S5 passes the current full Vitest, Demo/build, theme, locale, mobile and repository gates with temporary screenshot inspection. Post-S5 Chrome 152 with the official local WebMCPTesting flag now registers and invokes all six tools, proves visible cancellation/confirmation, persisted Pack/PDF read-back, live permission/Company/navigation retirement and 375px bounds; bundled Chromium 149 and the in-app browser remain explicit fallback environments. [TASK-229 native evidence](docs/ai-native/evidence/TASK-229-2026-09-09.md#post-s5-native-webmcp-acceptance--2026-09-09).

- [x] **G02.1** Register structured receipt search, authorized detail and Pack preparation/execution tools with feature detection and the ordinary UI retained when unsupported.
  - Evidence: [TASK-229 native WebMCP evidence](docs/ai-native/evidence/TASK-229-2026-09-09.md#post-s5-native-webmcp-acceptance--2026-09-09).
- [x] **G02.2** Bind tools to live actor, Company and page state; revoke stale registrations/context on navigation, Company switch, logout and permission change.
  - Evidence: [TASK-229 native WebMCP evidence](docs/ai-native/evidence/TASK-229-2026-09-09.md#post-s5-native-webmcp-acceptance--2026-09-09).
- [x] **G02.3** Keep draft edits, confirmation and execution state visible; prevent a tool from silently discarding unsaved work or bypassing server authorization.
  - Evidence: [TASK-229 native WebMCP evidence](docs/ai-native/evidence/TASK-229-2026-09-09.md#post-s5-native-webmcp-acceptance--2026-09-09).
- [x] **G02.4** Browser tests exercise the real receipt journey, invalid input, cancellation and stale scope in supported WebMCP browsers plus the unsupported-browser fallback.
  - Evidence: [TASK-229 native WebMCP evidence](docs/ai-native/evidence/TASK-229-2026-09-09.md#post-s5-native-webmcp-acceptance--2026-09-09).

### G03 — Provide an authenticated ERP MCP server

**Task:** [TASK-230](docs/ai-native/TASK-230.md) · **Priority:** P1 · **Phase:** Pilot
**Dependencies:** TASK-228, TASK-232, TASK-233.
**Current evidence:** TASK-230/S1 selects MCP `2025-11-25` Streamable HTTP at `/api/mcp/v1`, pins the official TypeScript SDK `@modelcontextprotocol/sdk@1.30.0`, defines external OAuth/OIDC protected-resource discovery and least-privilege scopes, and provides an executable local issuer/audience/expiry/revocation fixture. S2 adds the SDK transport, RFC 9728 discovery, six governed G01 tools, structured results and bounded request/result/time limits; S3 revalidates issuer/audience/scopes per call and proves wrong-audience, expired/revoked, guessed-Company and changed-approval no-write paths; S4 proves the same receipt-to-Pack intent through official TypeScript `1.30.0` and Python `mcp==1.27.2` clients, including dropped-response replay, changed-key conflict and artifact/source hash separation; S5 verifies local rate/error/version operations, full tests and repository gates. Production OAuth/JWKS, multi-instance rate capacity and deployment evidence remain G12/TASK-199.

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
**Current evidence:** Encrypted integration connectors exist; a general outbound MCP client is not established.

- [ ] **G04.1** Implement a Company-owned outbound MCP connection lifecycle with encrypted credentials, explicit authorization, health, pause and revocation.
- [ ] **G04.2** Allowlist destinations and approved tool versions; require review when tool definitions or requested scopes change and defend outbound requests against SSRF.
- [ ] **G04.3** Enforce field minimization and an explicit egress policy; treat remote tool content as untrusted data and require approval for external side effects.
- [ ] **G04.4** Prove one selected read-only document or calendar connector end to end, including malicious instructions, timeout, credential rotation and revoked-access denial.

### G05 — Establish least-privilege agent identity and delegation

**Task:** [TASK-232](docs/ai-native/TASK-232.md) · **Priority:** P0 · **Phase:** Foundation
**Dependencies:** TASK-227.
**Current evidence:** TASK-232/S1-S5 now map, implement and verify tenant-scoped Agent/service principals, current-owner-intersected grants, an issuer-separated `/api/agent/actions` boundary, hash-only credential rotation, administrator lifecycle controls and non-superuser PostgreSQL/FORCE RLS proof. Local API-mode desktop/375px checks show the Agent Governance screen without the earlier false Demo write-disabled banner; production and physical-device evidence remain separate release gates.

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
**Current evidence:** TASK-233/S1 defines server-owned read, draft, confirmed-execution and approval-required action classes. S2 persists actor/Company-bound reviewed facts, resource-version/selection/payload digests, hash-only execution keys and server expiry with human-only approve/reject/cancel. S3 rechecks the authenticated grant and approved intent, locks source rows, inserts the exact reviewed selection, serializes concurrent edit/insert outcomes and replays one immutable Pack. S4 proves pre-commit cancel/reject, post-commit approval-change replay, expired-grant denial, changed-payload conflict and governed source correction. S5 verifies P06-P12, persisted Pack/artifact postconditions, disposable PostgreSQL isolation, authenticated desktop/mobile browser behavior, generated/static gates and the full suite.

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
**Current evidence:** Governed document OCR/Vision exists; wizard AI selection is preview-only and no broad reporting/NL-query assistant exists. TASK-234/S1 defines the server-owned provider request/response/tool-call contract, explicit draft/waiting/running/succeeded/failed/cancelled states, whole-run deadline/cancellation, input/output/call/retry/cost limits, pre-call cost reservation and actionable fail-closed errors. TASK-234/S2 adds Company-scoped provider/model/data-policy configuration, AES-GCM credentials, explicit rotation/provider-change decisions, bounded limits, model/egress validation, permission/idempotency boundaries and secret-free views/audits. TASK-234/S3 adds the server-owned bounded Receipt conversation loop, cited facts, exact Pack preview, G06 confirmation wait/resume, governed Pack execution, persisted Pack read-back and artifact/source hash verification. TASK-234/S4 adds the contextual vanilla-JS workspace with visible sources, exact preview/confirmation, progress, cancellation, recovery, Company-scope isolation, five locale resources, both themes and desktop/375px focus/touch evidence; S5 passes the fixture, actual Demo/PGlite Pack/artifact assertions and local gates. No real provider account or approved spend is available, so the real-provider gate remains explicit and TASK-234 stays in progress. [TASK-234/S1 evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s1--define-runtime-states-and-limits) · [S2 evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s2--implement-secret-safe-server-configuration) · [S3 evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s3--implement-the-receipt-conversation-loop) · [S4 evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s4--build-the-contextual-workspace) · [S5 evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s5--validate-fixture-and-real-model-journeys).

- [x] **G07.1** Implement a server-owned provider interface and Company configuration with encrypted secrets, allowed models, data policy, bounded timeout and per-run cost/call budgets.
  - Evidence: [TASK-234/S1-S2 evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s2--implement-secret-safe-server-configuration).
- [x] **G07.2** Provide contextual chat, cited receipt results, Pack preview and confirmation, with distinct draft, waiting, running, succeeded, failed and cancelled states.
  - Evidence: [TASK-234/S3-S4 evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s4--build-the-contextual-workspace).
- [x] **G07.3** Complete the real receipt-to-Pack journey using governed tools and verified database/artifact postconditions; the assistant cannot announce success from model prose alone.
  - Evidence: [TASK-234/S3-S4 governed execution evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s4--build-the-contextual-workspace).
- [x] **G07.4** Prove provider failure/cancellation and zero credential leakage; test en/ms/zh/ja/vi, light/dark, desktop/mobile and accessible focus/keyboard behavior.
  - Evidence: [TASK-234/S4-S5 failure, locale, theme and accessibility evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md#s5--validate-fixture-and-real-model-journeys). The later [TASK-232 locale remediation](docs/ai-native/evidence/TASK-232-2026-09-09.md#post-s5-agent-governance-locale-remediation) closes the separate global i18n follow-up; provider, production and physical-device evidence remain separate.

### G08 — Build permission-aware ERP semantics and knowledge retrieval

**Task:** [TASK-235](docs/ai-native/TASK-235.md) · **Priority:** P1 · **Phase:** Expansion
**Dependencies:** TASK-228, TASK-232.
**Current evidence:** TASK-235/S1 defines the versioned Company Receipt semantic contract, server-derived scope/visibility, inclusive date and Company-timezone semantics, ready-only status policy, currency-separated deterministic totals, as-of timestamp and receipt/document/version source IDs. S2 reuses the authenticated G01 `receipt.search` selection boundary with a fixed projection, server-resolved Company timezone, keyset pages and a 5,000-row fail-closed bound; authenticated API/PGlite fixtures reconcile own/company/mixed-currency totals and source IDs while rejecting tenant tampering, invalid ranges and revoked access. S3 registers only approved current managed-document versions with clean scans, successful extraction, Company-scoped effective dates and server-owned field allowlists; authenticated `/api/knowledge/sop` checks live permission before returning bounded content and excludes expired/revoked/field-denied/cross-Company sources while labeling embedded instructions as untrusted data. S4 adds resolvable governed citations with document/version/source-hash identity, effective policy dates and as-of times; grounded policy, explicit unknown/conflict evidence and grounded transaction-fact labels are returned, while actor/Company/authorization-version scoped cache entries are invalidated by source fingerprints. S5 closes accuracy/isolation with full regression and repository gates, including cache warm/cold, cross-Company, live permission downgrade and stale/revoked citation non-disclosure tests. PostgreSQL, provider and production-runtime evidence remain separate release gates. [S1 evidence](docs/ai-native/evidence/TASK-235-2026-09-09.md#s1-define-the-semantic-contract) · [S2 evidence](docs/ai-native/evidence/TASK-235-2026-09-09.md#s2-implement-bounded-factual-reads) · [S3 evidence](docs/ai-native/evidence/TASK-235-2026-09-09.md#s3--implement-scoped-sop-retrieval) · [S4 evidence](docs/ai-native/evidence/TASK-235-2026-09-09.md#s4--add-citations-and-freshness-rules) · [S5 evidence](docs/ai-native/evidence/TASK-235-2026-09-09.md#s5--verify-accuracy-and-isolation).

- [x] **G08.1** Define owned metric/entity contracts including Company, time period, timezone, currency, status and source IDs; compute financial facts through deterministic ERP reads.
  - Evidence: [TASK-235/S1 contract](docs/ai-native/evidence/TASK-235-2026-09-09.md#s1-define-the-semantic-contract) · [TASK-235/S2 bounded read](docs/ai-native/evidence/TASK-235-2026-09-09.md#s2-implement-bounded-factual-reads).
- [x] **G08.2** Retrieve selected SOP/policy documents with tenant, record and field permissions checked before content reaches the model.
  - Evidence: [TASK-235/S3 scoped SOP retrieval](docs/ai-native/evidence/TASK-235-2026-09-09.md#s3--implement-scoped-sop-retrieval).
- [x] **G08.3** Return source links, record versions/as-of times and explicit unknown or conflicting evidence; distinguish transaction facts, policy and AI inference.
  - Evidence: [TASK-235/S4 citations and freshness](docs/ai-native/evidence/TASK-235-2026-09-09.md#s4--add-citations-and-freshness-rules).
- [x] **G08.4** Prove inaccessible/expired documents, contradictory policies, Company switching and revoked access cannot leak data through retrieval, caches or Agent memory.
  - Evidence: [TASK-235/S5 accuracy and isolation](docs/ai-native/evidence/TASK-235-2026-09-09.md#s5--verify-accuracy-and-isolation).

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
**Current evidence:** Canonical routes and partial workflows exist. TASK-238/S1 publishes a source-backed matrix for six selected journey areas with owner roles, tests and explicit exclusions; S2 records a proposed same-customer/same-currency settlement policy and SG/MY applicability worksheet, but product/finance and qualified tax-owner decisions are not approved. Settlement closure, all-module E2E and complete SG/MY statutory support are not proven. [S1 evidence](docs/ai-native/evidence/TASK-238-2026-09-09.md#cross-module-capability-matrix) · [S2 proposal](docs/ai-native/evidence/TASK-238-2026-09-09.md#s2--proposed-settlement-and-market-applicability-decisions-not-approved)

- [ ] **G11.1** Publish an owner-reviewed capability matrix for order-to-cash, procure-to-pay, record-to-report, inventory, HR/leave/payroll and receipt/evidence flows with explicit exclusions.
  - Evidence: [TASK-238/S1 source-backed matrix](docs/ai-native/evidence/TASK-238-2026-09-09.md#cross-module-capability-matrix); owner review remains pending.
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
