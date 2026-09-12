# TASK-193 — Employee credential-envelope fail-closed boundary

Date: 2026-09-13, Asia/Singapore. This record covers a local source and
PGlite-fixture increment for TASK-193. It does not claim production SMTP,
Platform Superadmin recovery, PostgreSQL/RLS acceptance or human approval.

## Identity and scope

- **Task:** TASK-193, temporary employee credential and recovery boundary.
- **Selected gap:** account creation/reset and temporary-secret reveal accepted
  truthy persisted values without first proving the server encrypted-token
  envelope. A malformed or cryptographically tampered value could therefore
  reach the decryptor and expose an unbounded implementation error.
- **Expected result:** create and reset reject malformed envelopes before any
  write; active-secret and reveal paths reject malformed or tampered persisted
  values with the bounded `temporary_credential_unavailable` response; no
  plaintext or crypto detail is returned; authenticated tenant scope and the
  existing approval/audit boundaries remain unchanged.
- **Actor / environment:** Codex on local macOS, root `main`, PGlite fixtures;
  no production database, SMTP server, Platform Superadmin account, provider,
  deployment or secret was used.
- **Baseline:** the worktree contained unrelated tracked and untracked changes;
  they remain preserved. Before the focused commit, the index was empty and
  there were no unmerged paths.

## Implementation and observed result

Commit `5533648adf60dd3b97a6fa5622f1ddfe16084528` (`Fail closed on malformed
employee credentials`) contains exactly:

- `src/modules/hr/employeeAccount.ts`: validate the exact encrypted envelope
  before create/reset writes and before returning an active temporary secret.
- `src/auth/employeeAccountLifecycle.ts`: map decrypt failures to the bounded
  `temporary_credential_unavailable` application error without crypto details.
- `src/modules/hr/employeeAccount.test.ts`: cover malformed and tampered
  persisted values plus create/reset rejection before state changes.
- `src/api/employeeAccount.integration.test.ts`: verify the API response is
  bounded and excludes both plaintext and decryptor error text.

The existing authenticated route still derives `masterFn` and `companyFn` from
the session, and audit append remains successful-reveal-only. No recovery token,
password, key or credential value is recorded here.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npm test -- --run src/auth/tokenCrypto.test.ts src/modules/hr/employeeAccount.test.ts src/api/employeeAccount.integration.test.ts --reporter=dot` | Envelope, HR command and API regression passes | 3 files / 19 tests passed; exit 0 |
| `npm run lint` | No lint errors or warnings | Exit 0 |
| `npm run typecheck` and `npm run typecheck:web` | Type checks pass | Both exit 0 |
| `npm run demo` | Demo/PGlite transaction, approval, stock and GL proof passes | Exit 0; output reports no `POSTGRES_URL`, so PostgreSQL parity was not exercised |
| `npm run build:demo` | Demo bundle builds | Exit 0; existing Vite external/eval and chunk-size warnings only |
| `npm run docs:check` | Documentation links pass before this record | 89 Markdown files / 811 local links |
| `git diff --check` and `git diff --cached --check` | No whitespace errors | Exit 0 |

The focused pre-commit command also passed the two changed HR/API files with
16 tests; the post-commit run above adds the token-crypto regression. The
recorded counts are separate runs and are not treated as new product
capabilities.

## Acceptance boundary

This increment proves the local source and PGlite-fixture custody boundary only.
TASK-193 remains **Blocked**. The missing resources are:

1. **Identity engineer / mail operator:** an approved production SMTP test
   sink or delivery configuration location and bounded recipient scope, so an
   isolated reset can prove expiry, replay protection and delivery without
   recording a secret.
2. **Platform Superadmin owner:** the approved separate platform-recovery
   design and an owner to exercise it; tenant recovery cannot stand in for
   platform recovery.
3. **Database/release owner:** PostgreSQL/RLS and current-head CI evidence for
   the governed path, followed by human acceptance of the recovery outcome.

The unblock action is to provide those approved resource locations, roles and
scope (never credentials in chat or source), then run one isolated production
recovery and record delivery, replay/expiry, tenant isolation, PostgreSQL/RLS
and human review evidence. Until then no task, GOAL criterion or checkpoint
count changes.

## Current handoff

- **Source revision:** `5533648adf60dd3b97a6fa5622f1ddfe16084528` on `main`.
- **Repository state at evidence creation:** 33 dirty paths remain, no
  unmerged paths exist, and the index is empty. The dirty paths include
  pre-existing documentation, receipt, HR, registry and evidence work and
  were not included in this focused commit.
- **Branch relation:** `main` is 22 commits ahead of `origin/main`; no push was
  attempted.
- **Local, fixture, Demo, PostgreSQL and production evidence:** local source and
  PGlite fixture checks are recorded above; Demo transaction/build checks pass;
  no PostgreSQL target was configured for this run; production SMTP,
  Platform Superadmin, provider, deployment and human acceptance are open.
- **Next measurable action:** obtain the approved SMTP sink/configuration scope
  and Platform Superadmin recovery owner/design, then run the isolated delivery
  and recovery proof with PostgreSQL/RLS and human acceptance recorded
  separately.
