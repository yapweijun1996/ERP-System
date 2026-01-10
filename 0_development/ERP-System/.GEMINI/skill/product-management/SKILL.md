---
name: product-management
description: "Run product management work end-to-end with a senior PM workflow: define outcomes and success metrics, discover user needs, prioritize with clear tradeoffs, write PRDs, align stakeholders, partner with engineering/design, launch safely, and iterate with feedback loops."
version: "1.0"
tags: [workflow, sop, docs, dev]
---

# Goal
Turn a business problem or product idea into a shipped, measurable outcome through clear strategy, crisp requirements, aligned stakeholders, disciplined prioritization, and a reliable execution + learning loop.

# When to Use
- You need to define or refine a product/feature from discovery to launch.
- You need a repeatable PM process to write PRDs, prioritize roadmaps, and align teams.
- You need to run a launch and iterate based on real user/metric feedback.

# Inputs
- Business context: objectives, constraints, and why now.
- Users and segments: who it’s for, current pain points, and context of use.
- Evidence: qualitative feedback, analytics, support tickets, sales insights, competitive notes.
- Constraints: time, team capacity, dependencies, legal/compliance, platform limitations.
- Success metrics: north-star metric and supporting metrics (leading/lagging).
- Constraints:
  - Prefer outcome-based goals over feature lists.
  - Do not invent data; label assumptions and propose how to validate them.

# Output
- A decision-ready PRD (or lean spec) with:
  - Problem, goals/non-goals, success metrics
  - Users, JTBD, and key scenarios
  - Scope (MVP) + milestones and phased rollout
  - Requirements (functional + non-functional), edge cases
  - Risks, dependencies, tradeoffs, and open questions
- A prioritized plan (roadmap/backlog) with rationale.
- A launch plan (instrumentation, rollout, comms, support) and post-launch iteration plan.

# Procedure
1. Frame the problem and outcome.
   - Write: “We believe <user/segment> has <problem> causing <impact>. We’ll know it’s solved when <metric> improves by <target>.”
   - Define non-goals to prevent scope creep.
2. Understand users and context (discovery).
   - Collect evidence: interviews, support logs, analytics funnels, session recordings, sales calls.
   - Identify primary JTBD and top failure points in the current experience.
3. Define success metrics and instrumentation.
   - Choose a north-star metric for this problem and 3–5 supporting metrics.
   - Define how you’ll measure: events, properties, cohorts, baselines, and target date.
4. Generate solution options (not just one).
   - Draft 2–3 candidate approaches with pros/cons.
   - Include “do nothing” and “simpler MVP” options to calibrate value vs effort.
5. Prioritize with explicit tradeoffs.
   - Use a simple framework appropriate to your org (RICE, MoSCoW, cost of delay).
   - State what is deprioritized and why (opportunity cost).
6. Write a PRD that engineers/designers can implement.
   - Problem, goals, non-goals, assumptions.
   - User stories/scenarios (happy path + key edge cases).
   - Requirements: functional, UX expectations, performance/reliability, accessibility, compliance.
   - Dependencies and rollout plan (flags, canary, migration).
   - Open questions with owners and deadlines.
7. Align stakeholders early and often.
   - Identify decision makers and approvers.
   - Run a review focused on: goals/metrics, scope, risks, timeline, and tradeoffs.
   - Capture decisions in writing and update the PRD.
8. Partner with engineering/design during execution.
   - Break work into milestones with measurable outputs.
   - Maintain a single source of truth for scope changes; guard the MVP.
   - Remove blockers (dependencies, approvals, unclear requirements).
9. Plan the launch like an operator.
   - Instrumentation and dashboards ready before rollout.
   - Rollout strategy: internal → beta → percentage rollout → full launch (as appropriate).
   - Customer comms, support readiness, and incident response plan.
10. Post-launch: learn and iterate.
   - Compare results to baseline; decide: iterate, roll back, or scale.
   - Capture learnings, update backlog, and close the loop with stakeholders and users.

# Verification (Acceptance Checks)
- [ ] Problem statement, goals, and non-goals are explicit and agreed.
- [ ] Success metrics are defined with baseline + target, and instrumentation is planned.
- [ ] PRD includes edge cases, non-functional requirements, dependencies, and open questions with owners.
- [ ] Prioritization rationale is documented (why this now; what got cut).
- [ ] Launch plan includes rollout strategy, monitoring, and support readiness.
- [ ] Post-launch review is scheduled with clear decision criteria (iterate/rollback/scale).

# Failure Modes & Recovery
- **If the team debates solutions too early**: pause → restate problem + metrics → gather evidence → return with options and tradeoffs.
- **If scope keeps expanding**: reinforce non-goals → freeze MVP → move extras to a clearly named backlog with rationale.
- **If stakeholders disagree**: tie decisions to outcomes/metrics and constraints → present 2–3 options with tradeoffs → get an explicit decision.
- **If engineering estimates are uncertain**: split into discovery spikes → validate riskiest assumptions first → re-scope based on findings.
- **If metrics aren’t moving**: verify instrumentation → segment cohorts → run qualitative follow-ups → adjust hypothesis and iterate.
- **If missing info**: ask user “What is the target user and the outcome metric you care most about for this initiative?”

# Examples
## Example A
**User request:** “Reduce churn in the first 7 days for new users.”
**What you do:** Define churn metric + cohort → map onboarding funnel → identify top drop-off points → propose 2–3 solutions → pick MVP → write PRD with instrumentation → staged rollout → measure and iterate.
**Result:** A PRD + prioritized plan + launch/measurement plan tied to churn reduction.

## Example B
**User request:** “Launch a new billing plan for SMB customers.”
**What you do:** Clarify segment + revenue goals → define pricing requirements and constraints → align legal/finance/support → PRD with edge cases (downgrade, prorations, invoicing) → rollout with monitoring and comms → post-launch review.
**Result:** A launch-ready plan and PRD with cross-functional alignment.

# Notes (optional)
- Strong PM work is “clarity at the boundaries”: crisp outcomes, crisp scope, crisp decisions.
- Treat every roadmap item as a hypothesis; shipping is the start of learning, not the end.
