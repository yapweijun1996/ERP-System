# TASK-253 Staff directory proposal · Round 1

The companion SVG is an illustrative desktop and mobile after mockup based only on the supplied screenshots. It is a visual proposal, not a live application capture.

## Filter layout and behavior

- Keep the existing employee search and department chips. On desktop, place them alongside two clearly labelled controls: **Employment status** (a multi-select with Current and Former) and **Job title** (a searchable selector). Default to all statuses and all job titles.
- Combine search, department, employment status, and job title selections with AND logic. Keep the existing People count and headcount / leave KPI cards visible as shown; show the matching-result count above the table so filtering does not overwrite those counts.
- On mobile, keep search visible and make **Filters** open a labelled bottom sheet for employment status and job title. Keep department chips horizontally scrollable below search. The filter sheet has a close action, an Apply action, and a clear-selection action.
- Preserve the table order: Employee, Department, Role, Type, Joined, Status. On mobile, constrain horizontal scrolling to the table region, keep Employee as the sticky first column, and show a “Swipe for more columns” cue. The document itself should not scroll sideways.

## Empty filter state

When the selected filters return no employees, keep the heading, KPI cards, search, department controls, filters, and a **0 results** count visible. Replace only the table body with “No employees match these filters,” a short suggestion to broaden the status or job title, and **Edit filters** / **Clear filters** actions. Keep the user's search text when clearing filter selections; provide a separate clear-search control.

## Accessible names and interaction

- Give search the persistent label “Search employees by name or employee number.”
- Label the multi-select “Employment status”; expose “Current” and “Former” as individually named options and announce selected values.
- Label the searchable selector “Job title.” Department chips use a named group and expose selected state (for example, `aria-pressed`).
- Name the mobile trigger “Open employee filters” and expose `aria-expanded`; the sheet uses a dialog name such as “Employee filters,” its icon-only close button has the name “Close employee filters,” and the sheet receives focus when opened. Return focus to the trigger when it closes.
- Use semantic table headers. Name the mobile scroll region “Employee results table; scroll horizontally for more columns.” Announce result-count changes and the empty state with a polite live region. Do not use color alone for status or selection.

This round covers visual hierarchy and responsive filter placement only. It does not inspect or change implementation behavior.
