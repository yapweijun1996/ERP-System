---
name: ui-ux-design
description: "End-to-end UI/UX workflow from brief to build-ready design: define users/JTBD, map flows, establish IA, produce wireframes + hi-fi UI aligned to a system, specify states/validations/accessibility, and hand off with acceptance criteria."
version: "1.1"
tags: [workflow, sop, ui, ux, design-system, frontend, docs]
---

# Goal
Turn a product brief into an implementable UI/UX design package with minimal ambiguity: users/JTBD, end-to-end flows (incl. edge cases), IA, wireframes, hi-fi UI aligned to a design system, explicit states/validations/accessibility, and engineering-ready acceptance criteria.

# When to Use
- Designing a new screen/feature from scratch.
- Redesigning an existing UI with usability/discoverability/consistency problems.
- Preparing a handoff where engineering must build without repeated clarification.

# Inputs
- Problem statement (what/why now) + constraints + non-goals.
- Users & context: primary user types, device (web/mobile), accessibility level.
- Roles/permissions: who can do what, and where restrictions apply.
- Scope: in-scope screens/flows + explicit out-of-scope.
- Content & data: real-ish copy, entities/fields, empty/error examples.
- Constraints:
  - Platforms & breakpoints (web/iOS/Android)
  - Existing design system/components (or allow a minimal system)
  - Tech constraints (theming, localization, performance)
  - Compliance/privacy rules (if any)
- Reference checklist (baseline elements): `standard-ui-ux-elements.md`

# Outputs
A design package (single folder/doc set) containing:
- Users/JTBD summary + role/permission matrix
- Flow diagrams: happy path + critical edge cases
- IA/navigation notes (entry points, labels in user language)
- Wireframes (low-fi) for key screens
- High-fidelity UI aligned to a design system
- Interaction specs: states, validations, permissions, transitions
- Engineering handoff:
  - component inventory + states
  - token/spacing references
  - responsive rules
  - acceptance criteria (Given/When/Then) per flow/screen

# Procedure
## 0) Set the working mode (timebox + MVP)
- Timebox: small feature 1–3 days; complex flows 1–2 weeks.
- Lock MVP: 1 core job + 1 happy path + 3 critical edge cases.

## 1) Define the problem and success criteria
- Write a 1–2 sentence problem statement.
- Pick 1–3 measurable success metrics (time-to-task, completion rate, error rate, support tickets, retention, conversion).
- List non-goals and explicit out-of-scope items.

## 2) Identify users and JTBD
- List 1–3 primary user types, each with top 1–3 JTBD.
- Capture constraints: time pressure, device, expertise, language/compliance.
- Produce role/permission matrix: role → allowed actions → restricted actions/surfaces.

## 3) Map flows (happy path + edge cases)
- Draw happy path end-to-end.
- Add at least 3 critical edge cases:
  - empty state, error state, permission/role restriction
- Add when relevant:
  - offline/slow network, cancel/undo, retry, partial completion, session expired

## 4) Define IA and navigation
- Decide feature placement: global nav / settings / within object detail / contextual entry points.
- Name sections using user language (avoid internal terms).
- Define discoverability: how users find it from where they already are.

## 5) Create low-fi wireframes (content-first)
- Structure: title + primary action + secondary actions + feedback area.
- Content-first layout: headings, key fields, key entities, help text.
- Layout rules: hierarchy, spacing rhythm, scroll strategy, density (if applicable).
- Ensure destructive actions are separated and confirmed.

## 6) Specify states, validations, and behaviors
For each critical screen/component, define:
- Loading / Empty / Error / Success / Disabled / Validation
- Validation rules: required/optional, formats, limits, dependencies
- Validation timing: on blur / on submit / realtime
- Error copy: cause + fix + recovery action (retry/edit/contact support)

## 7) Apply visual design using a design system
- If system exists: reuse tokens/components/patterns; avoid one-off styling.
- If none: define minimum viable foundations:
  - tokens (type scale, spacing, color roles, radii, elevation)
  - 8–12 core components needed for this feature
  - interaction standards (focus/hover/pressed/disabled/error)
- Align components/patterns to `standard-ui-ux-elements.md` baseline.

## 8) Accessibility and content checks
- Keyboard navigation: focus order, visible focus, focus trap (modals), Esc close.
- Contrast + avoid color-only meaning.
- Labels/semantics: clear labels, error association (aria-describedby where needed).
- Copy clarity: action-first labels, concise helper text, consistent glossary.

## 9) Lightweight usability validation
- Test with 1–3 people: “Complete task X” (no coaching).
- Ask: “What would you click next?” “What do you expect to happen?”
- Capture friction points and iterate once on highest-impact issues.

## 10) Prepare engineering handoff
- Screen-by-screen spec: layout rules, components, states, validations, permissions.
- Responsive rules: breakpoint behaviors (stack/collapse/truncate/sticky).
- Analytics events (if required) + privacy constraints.
- Acceptance criteria per flow using Given/When/Then.

# Verification (Acceptance Checks)
- [ ] Problem statement + 1–3 success metrics + non-goals exist.
- [ ] Users/JTBD and role/permission matrix are documented.
- [ ] Happy path + at least 3 critical edge case flows exist.
- [ ] Each key screen has wireframe + hi-fi design and all relevant states specified.
- [ ] UI uses a consistent system (tokens/components) with no unnecessary one-offs.
- [ ] Accessibility baseline covered (keyboard, focus, labels, contrast, reduced motion where applicable).
- [ ] Handoff includes component inventory, responsive rules, and acceptance criteria sufficient to implement without ambiguity.

# Failure Modes & Recovery
- Requirements unclear → ask: “Primary user goal?” + “Single most important action on this screen?” then freeze assumptions in writing.
- Flow keeps expanding → restate scope → lock MVP flow → backlog extras with rationale.
- Stakeholders disagree → present 2–3 options + tradeoffs tied to success metrics → decide via priority/metric.
- UI becomes inconsistent → inventory components → replace one-offs with system tokens/components → re-run verification.
- Edge cases found late → update state specs first → then adjust UI; avoid patching only in code.

# Templates
## Problem statement
> Users need to ______ so they can ______. Today they fail because ______.

## JTBD
> When ______, I want to ______, so I can ______.

## Acceptance criteria
- Given ______, when the user ______, then ______.
- Edge case: ______ should result in ______.

# Examples
## Example A
**User request:** “Design a signup flow for a B2B app with SSO and email/password.”
**Do:** define metrics → map flows (SSO/email/forgot/error/permission) → wireframes → hi-fi using system → validations/copy → quick usability check → handoff with Given/When/Then.
**Result:** flow diagram + screens with states + engineering-ready specs.

## Example B
**User request:** “Improve the settings page; users can’t find billing.”
**Do:** JTBD + IA → new navigation/labels → wireframes → hi-fi with consistent components → quick validation → acceptance criteria + migration notes.
**Result:** updated IA + redesigned screens + implementation-ready checklist.

# Notes
- Prefer fewer, clearer screens; use progressive disclosure to reduce cognitive load.
- Use real sample content early to avoid layout surprises.
- Treat empty/error states as first-class product experience.
