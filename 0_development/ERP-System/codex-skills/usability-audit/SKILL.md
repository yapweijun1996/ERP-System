---
name: usability-audit
description: "Evaluate an app’s UI functions, buttons, and tools for end-user usability using a repeatable audit: task-based walkthroughs, heuristic review, accessibility checks, friction logging, severity scoring, and prioritized fixes with acceptance checks."
version: "1.0"
tags: [workflow, sop, frontend, design, testing]
---

# Goal
Assess whether functions/buttons/tools are easy for end users to understand and use, then produce a prioritized set of UX improvements with clear fixes and verifiable acceptance checks.

# When to Use
- You want to review an existing UI for usability issues (confusing flows, unclear buttons, too many steps).
- You’re about to ship a feature and need a final usability and accessibility pass.
- You want a structured checklist instead of subjective feedback.

# Inputs
- Product context: what the app is for and who the primary user is.
- Key tasks (3–7): the most important user journeys to complete.
- Environment: web/mobile, target devices, and any accessibility requirements.
- Artifacts (any available): URL/app build, screenshots, analytics, support tickets, user feedback.
- Constraints:
  - Prefer observable evidence (task completion, errors, confusion) over opinions.
  - Don’t propose large redesigns unless necessary; start with highest-leverage fixes.

# Output
- A usability audit report containing:
  - Task-based findings (where users get stuck and why)
  - A heuristic checklist with pass/fail notes
  - Severity scoring per issue (impact × frequency × effort)
  - A prioritized fix backlog with acceptance checks
  - Optional: quick prototype suggestions (copy, layout, interaction changes)

# Procedure
1. Define the audit scope and users.
   - Identify the primary user persona and their top goals.
   - Select 3–7 “must-win” tasks (e.g., signup, search, checkout, create record).
2. Set up a task-based walkthrough (core of the audit).
   - For each task: define start state, success criteria, and expected time/steps.
   - Walk the task as a first-time user (no insider knowledge).
3. Observe and log friction points.
   - Record: unclear labels, hidden actions, misleading affordances, missing feedback, error messages, excessive steps.
   - Capture screenshots and the exact UI element names/locations.
4. Evaluate controls (buttons/tools) with a micro-checklist.
   - Clarity: label matches outcome (“Save changes” vs “Submit”).
   - Visibility: primary action is obvious; secondary actions are present but not competing.
   - Feedback: click/tap produces immediate response (loading, toast, inline state).
   - Safety: destructive actions are guarded (confirmations/undo); defaults are safe.
   - Consistency: same action looks/behaves the same across screens.
5. Run a heuristic review (Nielsen-style).
   - System status visibility (loading/progress).
   - Match real-world language (no internal jargon).
   - User control and freedom (back/cancel/undo).
   - Consistency and standards.
   - Error prevention and recovery.
   - Recognition over recall (don’t make users remember).
   - Efficiency for repeat users (shortcuts, sensible defaults).
   - Minimalist design (avoid clutter).
   - Help/documentation where needed.
6. Run accessibility basics (minimum bar).
   - Keyboard navigation and visible focus.
   - Labels for form fields and controls; meaningful button names.
   - Contrast and non-color-only meaning.
   - Touch targets and spacing (mobile).
7. Validate with evidence (lightweight).
   - If possible: 1–3 quick usability tests (“complete task X”) with no coaching.
   - If not: use analytics/support data to estimate frequency (drop-offs, rage clicks, common tickets).
8. Score and prioritize issues.
   - Severity rubric (recommendation):
     - Impact: blocks task / slows / cosmetic
     - Frequency: common / occasional / rare
     - Effort: small / medium / large
   - Prioritize: high impact + high frequency + low/medium effort first.
9. Write fixes as actionable tickets.
   - For each issue: problem → proposed change → rationale → acceptance checks.
   - Include copy changes, UI placement, state behaviors, and edge cases.
10. Re-verify after fixes (mini regression).
   - Re-run the 3–7 key tasks; confirm the issue is resolved and no new confusion was introduced.

# Verification (Acceptance Checks)
- [ ] Audit covers 3–7 key tasks with defined success criteria.
- [ ] Each issue includes location, evidence (screenshot/steps), and a proposed fix.
- [ ] Issues are severity-scored and sorted into a prioritized backlog.
- [ ] Accessibility basics are checked (keyboard/focus, labels, contrast, touch targets where relevant).
- [ ] Top 3 fixes include concrete acceptance checks that can be verified in the UI.

# Failure Modes & Recovery
- **If you don’t know the key tasks**: ask user “What are the top 3 things users must succeed at in this product?”
- **If stakeholders disagree on “good UX”**: tie to task success metrics (completion rate/time/errors) → propose A/B or usability test.
- **If the audit becomes too broad**: narrow to must-win tasks → backlog the rest.
- **If missing info**: ask user “Is this web or mobile, who is the primary user, and what are the top 3 tasks to audit?”

# Examples
## Example A
**User request:** “Review my admin dashboard buttons and tools; users are confused.”
**What you do:** Define top tasks (create, search, export) → walkthrough → log friction → heuristic + accessibility checks → score → produce prioritized fixes with acceptance checks.
**Result:** A usability backlog (quick wins first) and a clear verification checklist.

## Example B
**User request:** “Before launch, check the checkout flow is easy to use.”
**What you do:** Task-based walkthrough with success criteria → evaluate CTAs and error handling → run 1–2 quick tests → prioritize fixes → re-verify.
**Result:** A launch-ready checklist and fixes that reduce drop-offs and confusion.

# Notes (optional)
- Start with tasks and evidence; heuristics support the diagnosis, not the other way around.
- “Easy to use” usually means: clear labels, predictable outcomes, fast feedback, and safe recovery.
