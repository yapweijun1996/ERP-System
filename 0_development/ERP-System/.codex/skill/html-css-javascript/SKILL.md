---
name: html-css-javascript
description: "Write and ship small-to-medium web UI features using HTML, CSS, and JavaScript: scaffold files, build semantic accessible markup, style with responsive CSS, add JS behavior safely, debug in DevTools, and verify with a checklist."
version: "1.0"
tags: [workflow, sop, frontend, dev, testing]
---

# Goal
Produce a working, maintainable web page or UI feature using plain HTML/CSS/JavaScript, with good structure, accessibility basics, responsive layout, and a clear verification checklist.

# When to Use
- You’re building a static page, prototype, landing page, or a UI feature without a frontend framework.
- You need a consistent way to implement a UI from a brief or mockup using HTML/CSS/JS.

# Inputs
- Requirements: what the UI should do (states, interactions, validations).
- Target devices: desktop/mobile, breakpoints, browser support constraints.
- Design references: mockups, colors/typography, spacing rules (if any).
- Data model: what data is displayed/edited and its constraints.
- Constraints:
  - Prefer no build tooling unless needed; start with static files.
  - Avoid inline JS/CSS for maintainability (unless the task is a single-file prototype).
  - Keep JS unobtrusive: HTML works without JS where reasonable (progressive enhancement).

# Output
- A minimal project (or feature) with:
  - `index.html` (semantic markup)
  - `styles.css` (responsive styling)
  - `app.js` (behavior)
- A short “how to run” note (file open or local server).
- A verification checklist (layout, a11y basics, interactions, edge cases).

# Procedure
1. Scaffold the project.
   - Create `index.html`, `styles.css`, `app.js`.
   - Link CSS/JS from HTML (`<link>` in `<head>`, `<script defer>` before `</head>`).
2. Build semantic HTML first (no styling).
   - Use meaningful elements (`header`, `nav`, `main`, `section`, `article`, `footer`).
   - Add accessible form markup: `label` + `for`, proper input `type`, and helper text.
   - Add landmarks and a single `h1`; keep heading hierarchy correct.
3. Define UI states and DOM hooks.
   - List states: loading/empty/error/success/disabled (as applicable).
   - Add stable selectors for JS hooks: `data-*` attributes (prefer `data-testid`/`data-action` style over styling classes).
4. Style with CSS in layers.
   - Set base styles: `box-sizing`, typography, spacing scale.
   - Layout: start mobile-first, then add breakpoints.
   - Use Flexbox/Grid for layout; avoid fixed pixel heights unless required.
   - Create reusable utilities sparingly (e.g., `.stack`, `.cluster`) or keep styles component-scoped.
5. Add JavaScript behavior (progressive enhancement).
   - Select elements via `data-*` hooks; avoid fragile selectors.
   - Use event delegation for lists/tables.
   - Keep state in JS minimal; reflect state via attributes/classes (`aria-expanded`, `hidden`, `disabled`).
   - Validate inputs and render inline errors with clear copy.
6. Debug with browser DevTools.
   - Inspect layout (box model, grid/flex overlays).
   - Use the console for runtime errors and network tab for fetch requests.
   - Test keyboard navigation (Tab/Shift+Tab/Enter/Escape) and focus order.
7. Verify responsiveness and accessibility basics.
   - Test common breakpoints and real content lengths.
   - Check contrast and ensure text is selectable and readable.
   - Ensure interactive elements are reachable and have visible focus.
8. Finalize “how to run” and handoff notes.
   - If fetch/XHR is used, run a local server (e.g., `python -m http.server`) instead of opening the file directly.
   - Document any environment assumptions (API base URL, required browser features).

# Verification (Acceptance Checks)
- [ ] `index.html` uses semantic structure and correct heading levels.
- [ ] Layout works at mobile and desktop widths; no horizontal scroll from overflow.
- [ ] All interactions work with keyboard; focus is visible and logical.
- [ ] Forms (if any) have labels, validation, and readable error messages.
- [ ] JS has no console errors on page load and common interactions.

# Failure Modes & Recovery
- **If styling is fighting JS hooks**: separate concerns → use `data-*` for JS and classes for styling → refactor selectors.
- **If layout breaks on small screens**: remove fixed widths/heights → adopt mobile-first CSS → add breakpoints.
- **If click handlers stop working for dynamic lists**: switch to event delegation on a stable parent element.
- **If forms submit unexpectedly**: set button `type` correctly (`button` vs `submit`) → prevent default only when necessary.
- **If missing info**: ask user “What should the UI do (states + interactions), what devices to support, and do you have a mockup or reference?”

# Examples
## Example A
**User request:** “Build a responsive pricing section with monthly/annual toggle.”
**What you do:** Scaffold files → semantic HTML cards → CSS grid responsive layout → JS toggle with `aria-pressed` and price updates → verify keyboard + mobile.
**Result:** A pricing section with accessible toggle and responsive layout.

## Example B
**User request:** “Create a contact form with validation and a success message.”
**What you do:** Semantic form markup → CSS for layout/states → JS validation (required, email format) → inline errors and success state → verify no reload and correct focus behavior.
**Result:** A form that validates inputs and shows accessible feedback states.

# Notes (optional)
- Prefer `defer` scripts and avoid blocking rendering.
- Use `prefers-reduced-motion` for animations and keep motion subtle.
