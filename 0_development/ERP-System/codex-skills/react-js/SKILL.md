---
name: react-js
description: "Build React JS features and pages with a repeatable workflow: scaffold project (Vite/Next), structure components, manage state with hooks, fetch data safely, handle routing/forms, style consistently, test key flows, and ship with performance and accessibility checks."
version: "1.0"
tags: [workflow, sop, frontend, react, testing]
---

# Goal
Implement a React UI feature end-to-end (components, state, data fetching, routing/forms, styling) in a way that is maintainable, testable, accessible, and ready to ship.

# When to Use
- You need to build or modify a React UI feature (new screen, component, flow, form, table).
- You need a consistent checklist for React implementation + verification before shipping.

# Inputs
- Product brief: what users are trying to do and what “done” means.
- UI scope: screens/components involved and the key states (loading/empty/error/success).
- Data needs: APIs/endpoints, schemas, pagination/sorting/filtering rules, auth requirements.
- Existing stack: Vite/CRA/Next.js, router (React Router/Next routing), state libs (if any), styling approach.
- Constraints:
  - Don’t introduce new libraries unless needed and agreed.
  - Don’t store secrets in the repo; use environment variables per framework conventions.

# Output
- Implemented React feature (components + hooks/state + styles) merged into the codebase.
- A short handoff note: how to run, where the feature lives, and key behaviors/edge cases.
- Verification checklist results (manual + tests, if present).

# Procedure
1. Confirm the project setup and conventions.
   - Identify framework/build tool (Vite/Next/etc.), TypeScript vs JS, lint/format tools, test runner.
   - Locate existing patterns: component folder structure, styling method, data fetching approach.
2. Break the feature into UI states and responsibilities.
   - Define states: loading, empty, error, success, and permission/role restrictions (if applicable).
   - Identify components: container/page, presentational components, shared components.
3. Design component API and data flow.
   - Define props/events for child components (inputs/outputs).
   - Keep state as local as possible; lift only when needed.
   - Use derived state (computed values) instead of duplicating state.
4. Implement the UI (structure first).
   - Build semantic markup and accessible controls.
   - Ensure a clear hierarchy, stable keys for lists, and predictable component boundaries.
5. Add behavior with React hooks (common patterns).
   - `useState` for local UI state; `useReducer` for complex state transitions.
   - `useEffect` for side effects; avoid infinite loops by managing dependencies carefully.
   - Use memoization (`useMemo`, `useCallback`) only when it solves a real performance or referential equality issue.
6. Fetch data safely (choose the existing pattern first).
   - Prefer existing app abstraction (e.g., `apiClient`, React Query/SWR) if present.
   - Handle cancellation/stale responses where needed; avoid setting state after unmount.
   - Show user-friendly error states; log details for debugging without exposing secrets.
7. Forms and validation.
   - Use controlled inputs for validation-heavy forms; uncontrolled where simpler.
   - Validate on submit and optionally on blur; show inline errors next to fields.
   - Prevent double-submits; show loading state and disable submit button when appropriate.
8. Routing and navigation (if applicable).
   - Follow existing routing conventions (React Router vs Next routing).
   - Preserve deep links (query params), handle back/forward, and set document titles if required.
9. Styling and consistency.
   - Use the existing styling system (CSS Modules/Tailwind/styled-components/etc.).
   - Keep spacing/typography consistent; avoid one-off magic numbers where tokens/utilities exist.
10. Testing and verification.
   - If the repo has tests: add/update unit/integration tests for the critical flow(s).
   - Always do a manual pass: keyboard navigation, responsive layout, and error handling.
11. Performance and accessibility pass.
   - Avoid unnecessary re-renders (don’t overuse context; split heavy components).
   - Check accessibility basics: labels, focus, aria where needed, color contrast, reduced motion.
12. Document and hand off.
   - Note where code lives, what props/contracts exist, and any configuration/env needed.
   - List edge cases handled and any known limitations.

# Verification (Acceptance Checks)
- [ ] Feature works across the defined states (loading/empty/error/success) with no console errors.
- [ ] Interactions are keyboard-accessible with visible focus and correct labels.
- [ ] Data fetching handles errors and avoids state updates after unmount.
- [ ] Styling matches existing system and is responsive at agreed breakpoints.
- [ ] If tests exist in the repo, critical paths are covered or explicitly justified as manual-only.

# Failure Modes & Recovery
- **If hooks cause re-render loops**: inspect `useEffect` dependencies → move derived values into `useMemo` or compute inline → avoid setting state from effects unless necessary.
- **If state is hard to manage**: switch to `useReducer` → model events/actions → centralize transitions.
- **If data flickers or shows stale results**: add request cancellation/staleness guards → adopt existing caching library pattern if available.
- **If routing breaks deep links**: preserve query params and path params → add explicit route config/tests.
- **If missing info**: ask user “What framework (Vite/Next), what routing/state libraries are already used, and what is the main user flow + edge cases?”

# Examples
## Example A
**User request:** “Add a paginated users table with search and an empty state.”
**What you do:** Define states → build `UsersPage` + `UsersTable` → fetch with existing client → manage query params for search/page → render loading/empty/error → add tests for search + pagination.
**Result:** A responsive users list that is shareable via URL and handles all states cleanly.

## Example B
**User request:** “Create a settings form with validation and save toast.”
**What you do:** Build form markup → implement controlled inputs + validation → disable submit while saving → show success/error feedback → verify keyboard flow and error messages.
**Result:** A settings form that prevents double-submit and provides clear feedback.

# Notes (optional)
- Prefer composition over deep prop drilling; introduce context only when multiple distant components need shared state.
- Keep effects focused; compute derived UI from props/state rather than syncing state unless required.
