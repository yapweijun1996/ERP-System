# Task Index

Reviewed: **2026-08-09**

The machine-readable task source of truth is
[`../tasks/tasks.jsonl`](../tasks/tasks.jsonl). This file is a human-readable index,
not a second task registry.

## Current totals

- Done: **168**
- In progress: **0**
- Todo: **6**
- Blocked: **1**
- Total: **175**

## Current authorization programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-169 | Done | Align architecture and documentation with current authorization code |
| TASK-170 | Todo | Separate platform principals and time-bounded support access |
| TASK-171 | Todo | Canonical permission registry and compatibility-key migration |
| TASK-172 | Todo | Assignment-scoped grants, targets and expiry |
| TASK-173 | Todo | Central authorization decision, explicit deny and safe explanation |
| TASK-174 | Todo | Fail-closed module/resource registry and authorization versioning |
| TASK-175 | Todo | Replace tenant Superadmin bypass with explicit Company Owner permissions |

## Latest completed task

- **TASK-168 — Done:** permission-aware shell navigation, global search, quick actions,
  module state, employee workspace behavior and the role matrix are verified against
  active-company capabilities. The authoritative Manager template and Demo v15 pack now
  use company scopes for generic sales/CRM/inventory/warehouse/project/service collections
  whose rows do not carry actor ownership. Actor-derived My Work and Team Calendar APIs
  continue to enforce direct/granted-tree boundaries. The complete 149-file Vitest set
  passes in three resource-safe shards: 599 passed, one expected skip, zero failures.

## Blocker

- **TASK-017:** physical-phone PWA verification. Automated desktop and emulated 375 px
  checks do not satisfy the real-device acceptance criterion.

See [ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md) for the current
implementation boundary and migration dependencies, and [EPICS.md](EPICS.md) for epic
acceptance criteria.
