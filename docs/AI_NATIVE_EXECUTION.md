# AI Native ERP Execution Guide

Reviewed: 2026-09-08. TASK-240 refines instructions only.
Read [GOAL.md](../GOAL.md) for the target and [AGENT_FOLLOWUP_PROMPT.md](AGENT_FOLLOWUP_PROMPT.md)
for the copyable handoff. The instructions are model-independent; the requested
handoff profile is GPT-5.6 Luna with Max reasoning, selected by the operator.

## Start here: one active implementation packet

1. Inspect `git status --short`. Preserve the existing goal/documentation changes.
2. Read AGENTS.md, CLAUDE.md, GOAL.md and current STATUS/ROADMAP. Resolve/search the
   project KB. Read only the selected packet's source files plus needed callers;
   there is no need to load all 12 packets into context.
3. Recompute progress with the read-only command in GOAL.md. Read the task's current
   dependencies; packet status labels are initial snapshots, not live state.
4. Resume a safely actionable in-progress task with known evidence, or choose the
   next eligible packet below. Do not implement a dependent task before prerequisites
   pass. A ready later-phase task does not override the phase order.
5. Set the selected task to `in_progress`. Announce the task, one S-checkpoint,
   expected output and planned verification. Work on that checkpoint only.
6. Implement, run the targeted check, inspect results and repair relevant failures.
   Check the S box only after its exit is observed; replace its evidence placeholder
   with a link to the dated record. Then proceed to the next S-checkpoint.
7. After S5, verify all four goal criteria and common DoD. Update GOAL/task/docs/KB
   and continue to the next eligible task without asking permission for routine work.

If an external requirement is unavailable, record the exact block once and continue
independent eligible work. Do not skip required evidence or repeatedly retry an
unchanged missing resource. Do not launch subagents or another task just to obtain
a different model; the operator chooses the model for this same execution workflow.

## Recommended sequence

The table is a dependency-valid default. Registry dependencies are authoritative.
The existing production priority TASK-199 may take precedence when genuinely
actionable; use the [inherited task guide](ai-native/INHERITED_TASKS.md).

| Order | Packet | Deliverable | Prerequisites |
| --- | --- | --- | --- |
| 1 | [TASK-228](ai-native/TASK-228.md) | Shared action contracts and dispatcher | TASK-227 |
| 2 | [TASK-232](ai-native/TASK-232.md) | Agent identity and delegated grants | TASK-227 |
| 3 | [TASK-233](ai-native/TASK-233.md) | Exact-intent confirmation and execution | TASK-228, TASK-232 |
| 4 | [TASK-230](ai-native/TASK-230.md) | Protected inbound MCP server | TASK-228, TASK-232, TASK-233 |
| 5 | [TASK-229](ai-native/TASK-229.md) | Native WebMCP page adapter | TASK-228, TASK-232, TASK-233 |
| 6 | [TASK-234](ai-native/TASK-234.md) | Server AI and contextual UI | TASK-230 |
| 7 | [TASK-235](ai-native/TASK-235.md) | Grounded semantic/document reads | TASK-228, TASK-232 |
| 8 | [TASK-236](ai-native/TASK-236.md) | Durable Agent runs | TASK-230, TASK-234 |
| 9 | [TASK-231](ai-native/TASK-231.md) | One approved external MCP connector | TASK-232, TASK-234 |
| 10 | [TASK-237](ai-native/TASK-237.md) | Reproducible evaluation and CI gate | TASK-229, TASK-230, TASK-231, TASK-234, TASK-235, TASK-236 |
| 11 | [TASK-238](ai-native/TASK-238.md) | Approved ERP/market journey closure | TASK-227; product scope decisions before implementation |
| 12 | [TASK-239](ai-native/TASK-239.md) | Production acceptance and operations | All listed registry dependencies, including eight inherited tasks |

TASK-228 has no dependency on the future MCP/WebMCP adapters. Its contract fixtures
prove that adapters use the same boundary; real protocol acceptance belongs to
TASK-229/230. TASK-232 uses a two-call revocation test before the durable engine
exists; TASK-236 must later verify the actual resumed-worker path.

## A checkpoint is not a task or a goal criterion

- 12 registered delivery tasks map to 12 goal workstreams and 48 goal criteria.
- Each packet has five S-checkpoints: 60 execution checkpoints altogether.
- Checkpoint count shows incremental work, including interface/design preparation.
  It is not the AI capability completion percentage.
- No new task is created merely for S1/S2/S3/S4/S5. Keep the parent task open until
  all acceptance criteria and common DoD pass.
- If a real independent defect needs a new task, append the next unused TASK ID,
  link its epic and originating task, then explain the changed denominator.
- Do not invent a numeric completion estimate from lines changed or time spent.

## Testing runbook

### Local prerequisites and isolation

- Inspect package.json and the selected test's setup/teardown before running it.
  Do not assume an environment variable points to a disposable database.
- Use existing installed dependencies. If missing, use the committed lockfiles
  with `npm ci` and `npm --prefix web ci`; do not upgrade unrelated packages.
- Domain tests generally use isolated PGlite. Real PostgreSQL proof must use a
  positively identified disposable database and the repository proof guards.
- `TASK183_POSTGRES_URL` changes the receipt API E2E to PostgreSQL. Without it,
  the harness creates its own PGlite API. Neither path is a live production test.
- `POSTGRES_URL` may enable additional database work in proof scripts. Confirm
  the target safely before running; do not print connection strings or credentials.
- Never run migrate, seed, reset, purge or fixture setup against production for tests.
  Do not destroy a database or container merely because its name looks temporary.
- Keep Node/E2E scripts out of the Vitest suite; the existing configuration excludes
  tests/e2e. Do not remove that exclusion to make a command discover a new test.
- New test filenames in a packet are proposals until implemented. Existing
  regression commands cannot prove the new feature by themselves.

### Time boundaries in HTTP integration tests

Short-lived approval intents, tokens and grants must share the executor's clock.
When an HTTP/MCP route uses real time, initialize fixture preparation time inside
each test setup and assert the intent is still current before testing cancellation,
replay or execution. A fixed historical preparation time can expire and mask the
behavior the test intended to exercise. Keep business transaction dates separate.

Use fixed clocks for unit tests only when the same clock is explicitly injected
through every relevant lifecycle operation. Preserve deliberate expired-token and
expired-intent cases. Never extend production TTLs, disable expiry or add a
client-controlled clock to repair a fixture. Search nearby approval integration
fixtures for the same pattern when one fails; do not repair only the first file.
This rule follows the source-verified G06/MCP recurrence recorded in
[TASK-234 evidence](ai-native/evidence/TASK-234-2026-09-09.md#integrated-regression-and-mcp-fixture-clock-repair).

### Normal code-change gates

Run the selected packet's focused regressions and the new targeted tests first.
Then run each common gate and inspect its exit/output:

```bash
npm run lint
npm run typecheck
npm run typecheck:web
npm run demo
npm run build:demo
npm run docs:check
git diff --check
```

Lint requires zero errors and warnings. Apply affected regression, browser,
PostgreSQL, permission and generated checks as required by CLAUDE.md and the
packet. Do not keep rerunning broad suites once relevant evidence is green unless
a new change/failure requires it. A failing command is not a completed gate.

After two unsuccessful fixes of the same failure, stop speculative edits. Recheck
the reproduction, assumptions and owning boundary, then choose a different
evidence-backed repair or record the precise blocker. Do not hide a race by simply
raising timeouts or label a failing test flaky without a demonstrated cause.

For schema changes: use the existing migration generator, regenerate Demo SQL and
check schema/pack/drift/RLS as applicable. Never edit generated SQL by hand or
remove historical migrations. For changed permissions: run `npm run check:permissions`
and affected authorization/access-matrix tests.

### In-app browser: manual E2E and debugging

For a static Demo journey:

```bash
npm run build:demo
npm run preview -- --port 4173 --strictPort
```

Read the actual ready URL and ensure it is the server you started. If 4173 is busy,
select an unused port; do not kill an unrelated process. Keep the server available
during the browser investigation.

When CUA tools are available, initialize a visible in-app tab using the documented
API. The following is an example only after the terminal confirms this URL:

```javascript
const tab = await cua.createBrowserTab("iab", "http://127.0.0.1:4173", { visible: true });
```

Read the returned tool documentation before snapshots, clicks, console/network
inspection or navigation. Do not guess method names. Use Node.js for fixtures,
test assertions and orchestration; use browser tooling for actual browser state.

For authenticated API-mode E2E, run:

```bash
npm run test:e2e:company-receipts-api
```

That existing harness owns an isolated API/database and closes them when finished.
Do not try to attach an in-app browser to its already-closed random port. For a
manual API investigation, deliberately add/use an isolated development fixture
that keeps the host alive until explicit cleanup, based on the existing harness;
never launch the production server with unknown database settings.

Verify real UI actions, pending/confirmation/cancel states, expected requests,
console errors, response errors and authoritative result records. Use desktop and
375px; inspect overflow/focus/drafts and relevant themes/locales. An injected
adapter fixture proves a UI contract only. Artificially marking scan jobs clean
in a test fixture does not prove a production scanner/provider.

If the in-app browser does not support native WebMCP, use a supported browser for
the native gate and disclose it. A stub/polyfill is not native support evidence.
Do not claim physical-phone acceptance from viewport emulation.

### Documentation-only gates

Run `npm run docs:check` and `git diff --check`. Verify root GOAL.md separately,
because the current checker scans README and docs only. Render Markdown, inspect
links/tables/checklists, validate IDs/dependencies/counts and read back KB updates.
Do not run full business tests just to validate prose; disclose that runtime
verification was not performed.

## Finding classification and deferral

| Situation | Required action | Can selected task become Done? |
| --- | --- | --- |
| New regression or unmet current DoD | Reproduce, repair and rerun original case | Only after verification |
| Existing defect that blocks the selected flow | Repair within scope or create a linked blocker and stop the affected path | No while acceptance is unmet |
| Independent non-blocking defect | Record evidence and append/link a follow-up task | Yes if all current DoD passes |
| Capability outside approved scope | Document limit and proposed task; obtain missing business intent if needed | Only for the unchanged accepted scope |
| Missing device/provider/access/approval | Record concrete prerequisite and safe work already completed | No for the affected evidence gate |
| Unknown cause | Investigate; label Unknown rather than assume unrelated | No if acceptance depends on it |

For a deferred finding record: unique task, severity, environment/revision, actor
class, reproduction, expected/actual outcome, source/evidence, impact, reason for
deferral, dependency and measurable DoD. Do not duplicate an existing issue.
Documenting a defect does not close it.

## Evidence and progress reporting

Use [EVIDENCE_TEMPLATE.md](ai-native/EVIDENCE_TEMPLATE.md). Store a short dated
record under docs/ai-native/evidence/TASK-NNN-YYYY-MM-DD.md when evidence actually
exists. Missing/unrun fields remain explicit. Do not commit raw tokens, provider
payloads or screenshots containing real personal data.

Report in Mandarin at startup, meaningful milestones, task transitions and final
handoff; during active work aim for no more than about 60 seconds between concise
updates. Include actual findings rather than command-by-command narration.

```text
Current task/checkpoint: TASK-NNN / Sx — state
Registry: total N | Done D | In Progress I | Todo T | Blocked B
Pending: N-D (explain any added/deferred task)
AI Native workstreams: X/12
Goal criteria: Y/48
Execution checkpoints: Z/60 (not capability acceptance)
This session: completed tasks C | accepted criteria K | checkpoints S
Findings: fixed F | deferred Q | active blockers R
Verification: actual passed/failed/not-run gates and evidence
Next: exact checkpoint/task or required external prerequisite
```

Use the GOAL.md count command after edits, not hardcoded numbers from this guide.
A counted checkpoint must have an evidence link. On interruption leave current
files, tests, remaining criteria and the exact next step; never claim continued
background work after ending the session.

Do not ask the user to choose routine implementation details. Obtain missing
business intent, irreversible/production authorization or material cost approval
only when actually required. Prepare a concrete reviewable proposal before asking.
End final handoffs with exactly four short A-D options; A is the best next action.
Do not turn those options into a pause after every checkpoint.
