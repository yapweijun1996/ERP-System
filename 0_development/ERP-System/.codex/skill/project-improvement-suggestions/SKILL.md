---
name: project-improvement-suggestions
description: "Review a project’s stated goals and current codebase to suggest high-leverage improvements (features, UX, reliability, security, performance, tooling), prioritized by impact/effort/risk with clear next steps and acceptance checks."
version: "1.0"
tags: [workflow, sop, dev, docs, agent]
---

# Goal
Given a project’s goal and current state, produce a prioritized list of improvement ideas (missing functions, enhancements, and risk fixes) that are actionable, scoped, and verifiable.

# When to Use
- You want ideas for what to build next based on a project’s goals and current capabilities.
- You want a structured “gap analysis” of what’s missing (features, quality, ops, docs).

# Inputs
- Project goal: vision/README/PRD/roadmap or a 3–10 line summary.
- Current state: repo structure, key flows, current features, known pain points.
- Constraints:
  - Don’t invent facts; label assumptions and ask only critical questions.
  - Avoid proposing changes that violate explicit constraints (no DB writes, no network, compliance).

# Output
- A prioritized backlog (top 10–20 items) with:
  - Title, category (feature/ux/reliability/security/performance/tooling/docs)
  - Rationale tied to project goals
  - Impact / effort / risk (low/med/high)
  - Concrete next step (first PR/task) and acceptance checks
- A “quick wins” shortlist (top 3–5) and a “big bets” shortlist (top 3).

# Procedure
1. Restate the project goal (1–2 lines).
   - Quote or summarize the goal; ask for it if missing.
2. Establish scope and constraints (ask only if critical).
   - Target users, platform, and any non-functional requirements (security/perf/uptime).
3. Inventory the current state (fast scan).
   - Identify: primary entrypoints, key modules, current features, tests/CI, deployment/ops.
   - Note what is missing: docs, observability, error handling, auth, data model clarity.
4. Build a “capability map” aligned to the goal.
   - List core user journeys and the supporting capabilities needed (UI, API, data, ops).
   - Mark which are: present, partial, missing, or risky.
5. Generate improvement candidates across categories (don’t overfit to one area).
   - **Product/Feature**: missing core flows, onboarding, exports/imports, integrations.
   - **UX**: clarity, navigation, empty/error states, mobile responsiveness, accessibility.
   - **Reliability**: retries, idempotency, background jobs, incident readiness.
   - **Security/Privacy**: authZ, secrets handling, input validation, logging redaction.
   - **Performance**: hot paths, caching, DB query patterns, bundle size.
   - **Tooling/Quality**: tests, linting/typecheck, CI gates, dev env setup.
   - **Docs/Ops**: runbooks, architecture overview, ADRs, release process.
6. Prioritize using a simple rubric.
   - Score each item: goal alignment (0–3), user impact (0–3), effort (0–3), risk reduction (0–3).
   - Sort by: high alignment + high impact + low effort + meaningful risk reduction.
7. Turn top ideas into actionable tasks.
   - For each top item, define:
     - A minimal first PR/task (smallest deliverable)
     - Acceptance checks (what must be true)
     - Dependencies and risks
8. Present the recommendation set.
   - Provide: Quick wins (3–5), Next sprint (5–10), Big bets (1–3) with sequencing.
9. Confirm next action.
   - Ask the user which item to implement first, or propose the top 1–2 to start.

# Verification (Acceptance Checks)
- [ ] Suggestions explicitly reference the project goal and current gaps.
- [ ] Each top item has a concrete first step and at least 2 acceptance checks.
- [ ] Prioritization is clear (impact/effort/risk) and constraints are respected.
- [ ] Assumptions are labeled; critical missing info is requested with ≤3 questions.

# Failure Modes & Recovery
- **If the project goal is unclear**: ask user “What is the project goal in 3–5 lines, and who is the primary user?”
- **If the repo is too large**: focus on the primary entrypoints and core flows → propose a staged review plan.
- **If there’s not enough context**: propose a default rubric-based shortlist → mark items as “assumption-based” and request confirmation.

# Examples
## Example A
**User request:** “Based on this repo’s goal, what should we build next?”
**What you do:** Restate goal → scan current features/tests/ops → map core journeys → propose 10–20 improvements → prioritize → provide quick wins + big bets.
**Result:** A prioritized backlog with concrete next steps and acceptance checks.

# Notes (optional)
- Keep suggestions “implementable”: a good idea includes who benefits, what changes, and how to verify it.
