# Retained Demo startup: bounded repair candidate (2026-10-01)

The owner-provided screenshots were locally materialized and visually inspected.
Wizard step 5 reports “Module catalogue is unavailable. Wait a moment and try again.”
The console reports “there is no unique or exclusion constraint matching the ON
CONFLICT specification” and switches to static fallback. This is a SQL constraint
failure, not evidence of a browser/cache/device cause. The exact missing constraint
in the owner's database is not known; no owner data was reset or inspected.

A real fresh public Chromium visit on revision `2ad84e1` initialized successfully.
A separate disposable public browser profile, with its credit-profile unique index
removed to model retained-schema drift, reproduced SQLSTATE `42P10`, the exact
console text and disabled sample entry. Its storage sentinel survived.
Previous fresh-boot and healthy previous-release retention checks did not exercise
missing `ON CONFLICT` arbiters. Table/column signatures and a high migration marker
could pass while an ordinary unique index was absent. This is the demonstrated
coverage gap; it does not establish how the owner's specific constraint was lost.

## Change boundary

`generate-demo-unique-indexes.mjs` loads the canonical generated schema and derives
only the 28 unique indexes used by explicit startup-fixture `ON CONFLICT` targets.
The compiled metadata is checked in CI. No Drizzle migration is changed.
`ensureDemoUniqueIndexes` validates all these expected indexes before startup
fixture writes. It restores missing ordinary canonical unique indexes in one
transaction. It never drops/replaces mismatched indexes, repairs missing primary
constraints, removes duplicates, edits records, assigns/grants access, or rewrites
migration markers. Duplicate rows fail unique-index creation and roll back all
pending repairs. Production/API mode cannot install the Demo adapter/runtime.
Retained draft top-up now follows compatibility/index validation. Initial fresh
canonical seeding remains unchanged.

A failed Modules step disables Continue, while Back/language/input controls remain
available. Ready recovery retains the existing in-place wizard behavior. Safe
failure diagnostics include startup stage, error code and source-owned asset/index
statement labels, without SQL text, original Error objects or record contents.
The service-worker cache revision changes; IndexedDB is never reset.

## Verification and limits

Focused PGlite tests cover healthy no-op, exact `42P10` reproduction/recovery,
retained records/authority, duplicate rollback (including a preceding repaired
index), same-name nonunique mismatch and missing primary-constraint denial.
Browser regression uses real fresh entry without preselected session/setup,
then disposable retained drift and reload. It checks repaired indexes, edited
Company, full staff roster, sentinel and revoked live membership. A mismatched
index remains fail closed and the empty Modules step cannot continue.
Chromium and desktop WebKit are the supported local verification engines; neither
is a physical Windows-machine or iPhone certification. Existing startup recovery,
full wizard and exact CI remain release gates. Final-head independent review and
actual Pages/public verification are required before merge/release.

Production PostgreSQL, grants, credentials, routes and other Air services are
untouched. The uncommitted BU/Position showroom work remains preserved separately.

## Local candidate results

- Initial candidate integrity/API boundary: 5 tests passed; metadata-review revision adds both reproduced denial cases and a healthy synchronized-rename control (8 tests passed).
- Chromium and desktop WebKit retained-schema browser regressions passed, including
  explicit failure controls, no page errors, retained Company/staff/sentinel and
  revoked-membership denial. WebKit uses the available local desktop executable;
  matched CI WebKit remains an exact-commit gate, not physical-device evidence.
- Existing complete wizard passed desktop, split-pane, reported pane, mobile and
  375px layouts plus selected-module visibility. Its “iPhone” label denotes a
  viewport simulation, not a physical iPhone.
- Lint (zero warnings), root/web typechecks, Demo transaction proof, Demo build,
  generated schema/index checks and documentation links passed.
- Original dirty inventory is byte-identical; source is isolated from the paused
  organization fixture work. No production activation occurred.

Exact commit/review/CI/Pages/public validation will be appended only when observed.

## Independent metadata review repair

Review reproduced two missed metadata checks: an ordinary same-name unique index
replacing an expected primary constraint, and a deferrable primary key with the
same index SQL. Both previously passed; the latter makes the actual fixture fail
with SQLSTATE55000. The validator now checks exact owning constraint type/name and
index immediacy/deferrability as well as definition/validity/readiness. Both fail
closed without data changes; primary/deferrable structures are never auto-repaired.
Safe source-owned statement labels identify fixture filenames or canonical index
creation, without logging SQL, original Error objects, duplicate values or rows.
The new exact head requires refreshed independent review and CI.
