---
name: mobile-responsive-design
description: "Design and implement mobile-first responsive UI with an experienced engineer workflow: define breakpoints and layout strategy, build fluid grids and components, handle touch ergonomics, optimize performance, and verify across devices and accessibility."
version: "1.0"
tags: [workflow, sop, frontend, design, testing]
---

# Goal
Create mobile-first, responsive UI that feels fast and usable on real devices (touch ergonomics, readable typography, stable layouts), scales up cleanly to tablet/desktop, and is easy to implement and maintain.

# When to Use
- You’re designing a new screen or component that must work on phones and larger screens.
- You’re fixing a desktop-first UI that breaks on mobile or feels hard to use on touch devices.

# Inputs
- Target platform(s): web responsive, mobile web, or hybrid; minimum supported browsers/devices.
- Primary user tasks on mobile: what users must complete quickly on a small screen.
- Content and data: real/representative copy, images, tables/lists, empty/error states.
- UI constraints: design system/tokens, existing component library, branding rules.
- Constraints:
  - Mobile-first by default; add complexity only when needed for larger screens.
  - Avoid fixed pixel layouts; prefer fluid sizing, flexible grids, and content-driven breakpoints.

# Output
- A responsive design spec (layout rules + breakpoints + component behaviors).
- Component-level rules: spacing, typography scale, touch targets, and state behaviors.
- A verification checklist for devices, accessibility, and performance.

# Procedure
1. Define mobile success criteria (engineer-first).
   - List the top 1–3 mobile tasks and the primary action per screen.
   - Set constraints: minimum tap target, max content density, and acceptable scroll depth.
2. Choose a responsive strategy.
   - Prefer **content-driven breakpoints** (layout changes when content breaks), not device-model breakpoints.
   - Start with 1-column mobile layout; expand to multi-column only when it improves comprehension.
3. Establish the layout system (foundation).
   - Use a consistent spacing scale (e.g., 4/8-based) and typography scale.
   - Define container rules: max width, gutters, and safe padding for small screens.
   - Use CSS Grid/Flexbox; avoid absolute positioning for layout.
4. Define breakpoints and rules (few, intentional).
   - Define 2–4 breakpoints max (e.g., base, sm, md, lg) aligned to layout shifts.
   - For each breakpoint, specify what changes: columns, nav pattern, density, and component sizes.
5. Design for touch ergonomics.
   - Ensure interactive elements have comfortable touch targets and spacing.
   - Place primary actions within thumb-friendly zones where possible.
   - Avoid hover-only interactions; provide explicit affordances (icons + labels, menus).
6. Handle responsive content patterns.
   - Long text: wrap, truncate with expansion, or use progressive disclosure.
   - Tables: convert to cards, allow horizontal scroll with clear affordance, or provide column picker.
   - Images/media: responsive sizing (`srcset`/`sizes`), aspect ratio handling, lazy loading where appropriate.
7. Define component behaviors and states.
   - For each key component, define: loading, empty, error, disabled, success, and validation.
   - Specify responsive behavior per component (e.g., “button becomes full-width on mobile”).
8. Navigation patterns (mobile-first).
   - Choose an appropriate pattern: bottom nav, hamburger/drawer, segmented controls, or inline nav.
   - Define where search, filters, and settings live on mobile (avoid hidden critical actions).
9. Performance and stability (what 20 years teaches).
   - Minimize layout shift (reserve space for images, skeletons).
   - Keep JS work small on mobile; avoid heavy reflows and large bundles.
   - Prefer CSS for simple interactions; reduce animation and respect `prefers-reduced-motion`.
10. Accessibility pass.
   - Ensure readable font sizes, sufficient contrast, visible focus, and correct labels.
   - Ensure keyboard navigation still works (especially for mobile web with external keyboards).
11. Verify on real devices and realistic data.
   - Test at least: small phone, large phone, tablet, desktop.
   - Test dynamic type/zoom (browser zoom, OS text size), and slow network simulation.
12. Produce the handoff spec.
   - Provide breakpoint rules, component behaviors, and edge case screenshots/notes.
   - Include acceptance checks and a “known limitations” list if any.

# Verification (Acceptance Checks)
- [ ] Mobile (small phone) layout supports the primary task without zooming or horizontal scroll.
- [ ] Tap targets and spacing are touch-friendly; no hover-only actions are required.
- [ ] Responsive rules are documented for each breakpoint (what changes and why).
- [ ] Content edge cases are handled (long text, empty/error states, large lists/tables).
- [ ] Performance basics are respected (no major layout shift; interactions feel responsive on mobile).
- [ ] Accessibility basics pass (labels, focus, contrast, reduced motion).

# Failure Modes & Recovery
- **If the UI feels cramped on mobile**: reduce density → prioritize primary task → move secondary controls behind progressive disclosure.
- **If breakpoints proliferate**: collapse to fewer breakpoints → use fluid sizing (`clamp`, `%`, `minmax`) → keep only content-driven shifts.
- **If tables are unusable**: switch to card layout or column picker → keep only the most important fields visible by default.
- **If performance is slow on mobile**: remove expensive effects → reduce JS and re-renders → lazy load non-critical assets.
- **If missing info**: ask user “Is this for web responsive or a specific mobile platform, and what are the top 1–3 tasks users must complete on mobile?”

# Examples
## Example A
**User request:** “Make this dashboard work on mobile; tables and filters break.”
**What you do:** Identify primary mobile tasks → convert tables to cards + optional horizontal scroll → move filters into a bottom sheet/drawer → define breakpoints → verify on small/large phones and tablet.
**Result:** A mobile-first dashboard with usable filters and readable data on small screens.

## Example B
**User request:** “Design a responsive checkout page.”
**What you do:** Mobile-first single column → progressive disclosure for optional fields → sticky primary action on mobile → define validation and error states → verify tap targets, keyboard flow, and layout stability.
**Result:** A responsive checkout flow that’s fast and easy to complete on phones.

# Notes (optional)
- Treat mobile as the default performance budget; if it’s fast on mobile, it’s usually great everywhere.
- Prefer fluid typography and spacing (`clamp`) to reduce breakpoint churn.
