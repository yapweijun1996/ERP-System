# Separately reviewable HR production release step

This is a proposal, not an executed deployment. Original checkout and populated
/erp services/database remain unchanged. Merge remains held for source dependency
and history review, relevant code review, and exact-head CI.

## Source and migration gate

Use only the reviewed commit and its source archive/manifest. Build API/Web from
that source; never copy an existing worktree's dist or seed fixture into release.
Recheck current main ancestry and approved migration journal immediately before
deployment. New current-main migration0118_classy_ronan is distinct from the removed
Company Profile migration0118_lucky_randall. Do not apply this branch to a DB with
that removed lineage without an explicit compatibility migration review.

The safe next production preparation is a separately blank PostgreSQL target,
with a distinct volume/database and restricted non-superuser runtime role.
No demo seeder may run there. Check Company/staff/Leave counts are zero before
first-run owner setup. Keep the existing populated target available for rollback.
Do not reuse disposable QA credentials or demo defaults.

## Narrow approval and credential boundary

Review must identify the exact new target/container/volume, backup destination,
runtime role grants and owner bootstrap identity. Generate strong credentials
through the established secret store and configure them without printing or
committing values. Bootstrap only the intended single Company and owner access;
no existing user's production BU/Position grants are activated by this migration.

The existing public /erp route points to the populated deployment. Switching its
upstream to a new target is a separate precise routing approval, including the old
upstream/revision for rollback. Do not modify DNS, Cloudflare Tunnel/Access, other
routes, AirShop or WhatsApp services under this proposal.

## Operator verification before exposure

After exact-commit CI and target review: verify blank DB state and migration hashes,
apply additive migration/RLS under migration credentials, restart API/Web/runtime,
then run isolated operator QA for setup/auth, tenant isolation, employee
create/read/update/end, BU/Position assignment and rights, governed Leave
balance/overlap/approve/reject/cancel/replay and all five locales/responsive layouts.
Use fictional QA only in a separate QA target. Production operator smoke uses
empty-state and owner setup, never synthetic personnel inserted into the real DB.
Capture release revision, health, migration journal, runtime role flags and backup
restore evidence before any approved upstream switch.

## Rollback

Before migration capture an encrypted/access-restricted backup and verified journal.
For a separate fresh target, retain the old populated service/DB and route revision;
rollback switches only the specifically approved upstream and source revision.
For the current-main additive schema, compatible application rollback retains
organization tables/columns and scope constraints; never drop data or edit the
migration journal to imitate another lineage. Revoke only individually reviewed
new grants if required. Disposable rehearsal proves schema/restore/restart behavior,
not approval to operate on the populated deployment.
