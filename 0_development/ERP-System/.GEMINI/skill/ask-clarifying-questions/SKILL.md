---
name: ask-clarifying-questions
description: "Ask high-signal clarifying questions to turn ambiguous requests into executable work: restate the goal, identify unknowns and constraints, ask up to 3 prioritized questions, propose defaults, and confirm acceptance criteria."
version: "1.0"
tags: [workflow, sop, docs, agent]
---

# Goal
Convert an unclear or underspecified request into a clear, actionable plan by asking only the minimum necessary questions, proposing sensible defaults, and confirming acceptance criteria.

# When to Use
- The request is ambiguous (“make it better”, “fix it”, “build a feature”) or missing critical details.
- You need to avoid wrong assumptions (scope, environment, constraints, definition of done).

# Inputs
- The user’s request and any existing context (repo, screenshots, logs, links, constraints).
- Known constraints: deadlines, security, budget, tools, non-functional requirements.
- Constraints:
  - Ask **max 3** questions at a time.
  - Prefer proposing defaults over asking many questions.
  - Do not request secrets (tokens, passwords); if provided, redact.

# Output
- A short restatement of the goal and intended outcome.
- Up to 3 clarifying questions (prioritized).
- Proposed defaults/assumptions (explicit) for anything not answered yet.
- A confirmed “definition of done” checklist.

# Procedure
1. Restate the goal (1–2 lines).
   - “You want <outcome>. This will enable <benefit>.”
2. Identify what is missing (unknowns) and classify them.
   - **Critical unknowns** (block execution): environment, scope boundaries, required output artifact, access/permissions, hard constraints.
   - **Non-critical unknowns** (can proceed with defaults): preferences, nice-to-haves, formatting.
3. Formulate up to 3 questions (in this priority order).
   1) **Where / what environment?** (repo, OS, runtime, prod vs staging, target audience)
   2) **What is the required output?** (file(s), format, API, UI, decision)
   3) **What constraints matter most?** (no DB writes, no network, performance/security, deadline)
4. Propose defaults for everything else.
   - Clearly label: “Default: <X>. Tell me if you want <Y> instead.”
5. Confirm acceptance criteria (“definition of done”).
   - Convert the request into 3–7 verifiable checks.
6. Proceed with execution once critical unknowns are answered.
   - If still blocked, ask the next 1–3 questions (don’t pile on).

# Verification (Acceptance Checks)
- [ ] You asked no more than 3 questions.
- [ ] Each question is necessary to start or prevent rework.
- [ ] You proposed explicit defaults for non-critical unknowns.
- [ ] Definition of done is written as verifiable checks.
- [ ] No secrets were requested or stored.

# Failure Modes & Recovery
- **If the user answers partially**: restate what’s still missing → ask 1–2 follow-ups only.
- **If the user says “just decide”**: choose defaults → state assumptions → proceed with reversible steps.
- **If the scope explodes**: define MVP → list non-goals → propose phased approach.
- **If missing info**: ask user “What is the final output you want (file/type), and where will this run (environment)?”

# Examples
## Example A
**User request:** “Make a skill for logging.”
**What you do:** Restate goal → ask 3 questions (language/runtime, target output, constraints) → propose defaults (structured JSON logs, correlation id) → define acceptance checks.
**Result:** Clear requirements for creating the logging skill without guesswork.

## Example B
**User request:** “Fix the slow page.”
**What you do:** Ask environment + page/route + baseline metric → propose defaults (profile first, no feature changes) → define done (p95 reduced, no regression).
**Result:** A bounded performance task with measurable outcome.

# Notes (optional)
- The best question reduces risk or prevents rework; if it doesn’t, default it.
