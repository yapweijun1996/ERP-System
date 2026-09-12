# TASK-234 — Goal and evidence link reconciliation

Date: 2026-09-13, Asia/Singapore. This documentation-only record keeps the
current goal links and TASK-236 evidence anchors resolvable. It does not promote
an application criterion, packet checkpoint or production/provider gate.

## Scope and expected result

- Root worktree revision: `0b26b336f2f7cbb3a19426eb533a6aae1250772b` on `main`, with the pre-existing dirty worktree preserved.
- Actor / environment: Codex, local macOS filesystem; no runtime, database, provider, deployment or external communication was used.
- Expected: every relative link in `GOAL.md`, `PROGRESS.md` and `GOAL_PROMPT.md` resolves to an existing local file and, when present, an existing Markdown heading or explicit anchor.

The repair adds stable S2–S5 anchors to the TASK-236 checkpoint table, updates
G08 links to the generated double-dash anchors for em-dash headings, corrects
the dated TASK-232 locale anchor, and removes stale fragment suffixes from
historical TASK-193/TASK-234 evidence links whose source documents have no such
heading. The linked records remain unchanged in meaning; the detailed facts stay
in the surrounding progress rows and evidence documents.

## Observed verification

| Check | Result |
| --- | --- |
| Root Markdown/link/fragment review | Pass, 3 files / 170 local links / 0 missing |
| GOAL count/dependency/mapping validator | Pass, 227 done / 6 in progress / 4 todo / 3 blocked; 31/48 criteria; 41/60 checkpoints; no dependency-ready Todo |
| Registry fingerprint | `aaa7dabbab59f42ec1c4ae1c705aaa259ad7e2f85b6f57824a42c04ab23e86de` |
| `npm run docs:check` | Pass, 83 Markdown files / 800 local links |
| `git diff --check` | Pass |

No registry row, GOAL checkbox, packet S-step or progress count changed. The
remaining TASK-234 G07.3 gate is still a real server/provider run followed by
authorized publication and hosted upload verification; the Demo and local
candidate evidence remain separately attributed.
