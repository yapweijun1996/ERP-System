# Public Demo startup incident and bounded repair

The owner supplied an iPhone screenshot of first-run setup at Finish with:
“Demo database unavailable (offline fallback) — Setup needs PGlite.” The actual
pixels were inspected from Library image IMG_9786.jpeg. This proves the browser
adapter lacked a writable database at the attempted setup; it does not identify
why that iPhone failed to initialize PGlite. The screenshot does not expose
the exact client revision, OS version or browser storage state.

At deployed source 6654fd0, fresh public Chromium and desktop WebKit with a
mobile viewport could initialize real PGlite. A second WebKit run crossed the
45-second watchdog and displayed fallback, then recovered to PGlite. This is
reproduction of delayed startup/fallback, not the owner's native iPhone failure.
The parent independently completed the unmodified public wizard in cloud Chrome;
Finish took about 30 seconds and led to sign-in without an obvious sample entry.

The 131-route localization gate used Chromium, required real PGlite, and set
setup-complete/session flags before navigating. It did not certify first-run
setup, WebKit, native iPhone, all cached releases or existing user databases.
A separate full-wizard Chromium test existed, but the merged CI workflow did
not invoke it. The previous zero-issues result is limited to the executed matrix,
not universal browser/device/state certification.

The repair exposes an explicit static-Demo-only sample entry on wizard/sign-in.
It authenticates the existing allowlisted fictional admin@acme.co identity and
selects its seeded C-SG workspace; it creates no identity, grants no new rights,
overwrites no Company and deletes no IndexedDB data. API mode installs no Demo
adapter or sample authentication. Production server authentication is unchanged.
Setup writes, existing mutation readiness checks and sample entry require
completed PGlite readiness; an open handle during unfinished initialization
does not make fallback writable. Loading/failure
status is shown, and late recovery retains typed wizard inputs. Failed startup
never marks setup complete or resets existing data.

CI adds real fresh startup/sample entry/reload/persistence on Chromium and
WebKit, plus deliberately delayed/aborted runtime regressions. Those controlled
failure tests are not native iPhone reproductions. CI also invokes the existing
full-wizard/sign-in/layout test. Native iPhone Safari and the owner's exact
existing database remain unverified until direct evidence is available.

No production PostgreSQL, credentials, grants, routing or services change.

Independent review identified two blockers on candidate 0d422f2. Both were
reproduced against its pre-repair bundle: a revoked Company assignment still
allowed sample entry and wrote local session/setup flags; public refresh during
a delayed credit fixture promoted fallback to PGlite while progress still said
fallback. The repair uses a private completed-initialization marker, so refresh
cannot promote readiness and switching/mutations cannot run before completion.
Live Company lookup and displayed role projection exclude revoked, expired and
future assignments and roles owned by another Master/Company. Legacy null-Company
roles follow the existing shared authorization contract. There is no independent
role isActive column in the current schema; assignment validity defines live
membership. Regression controls revoke/expire/future-date actual assignments,
use a wrong-Company role, restore valid membership, and assert denied entry writes
no session/setup flags. Disabled-account denial is a separate control.
