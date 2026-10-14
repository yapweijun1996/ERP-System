---
id: TKT-20260915-001
title: "Investigate and fix i18n browser audit failures"
type: bugfix
priority: P1
status: PR_READY
owner: ""
requestor: "user"
risk: LOW
scope:
  in:
    - "i18n browser audit findings reported by GitHub CI"
    - "setup-wizard translations for ms/zh/ja/vi"
    - "hardcoded UI strings identified by the audit"
    - "focused regression coverage"
  out:
    - "deployment configuration"
    - "unrelated UI behavior"
    - "commit or push"
constraints:
  - "localhost-first"
  - "Use repository i18n source-of-truth"
acceptance_criteria:
  - "Determine whether the findings predate dcc824b"
  - "All in-scope i18n browser audit findings are resolved"
  - "Focused regression coverage passes"
  - "No deployment configuration changes"
test_plan:
  - "Run the exact i18n browser audit"
  - "Run focused translation/browser tests"
  - "Run git diff --check"
rollback_plan:
  - "Revert the focused translation and test changes"
notes:
  - "Leave changes uncommitted in the forked workspace for review"
---

## Context

GitHub CI reported 138 blocking i18n browser-audit findings, including missing setup-wizard translations in ms/zh/ja/vi and hardcoded strings such as table/theme names.

## Requirements

Trace the audit, identify the authoritative translation source, compare the failure against commit dcc824b, and implement the smallest complete in-scope fix.

## Non-Goals

Do not change deployment configuration or unrelated UI.

## QA Checklist

- [x] Baseline reproduced and classified
- [x] Source-of-truth confirmed
- [x] Focused fix implemented
- [x] Existing setup-wizard regression coverage retained; targeted settings audit added through the shared locale path
- [x] Targeted audits/tests pass; full matrix contention is documented in the review report
