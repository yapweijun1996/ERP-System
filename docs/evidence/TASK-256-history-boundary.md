# TASK-256 history and dependency boundary

Local baseline 4f9234d; remote main 1b0a4c3; merge-base 4cca135568c06fc64f133ef3d819da1b5476d175.
Only absent local commit is 4f9234d, Company Profile. These baseline changes would be reintroduced by retaining its ancestry and are excluded from this clean mainline branch:

    M	deploy/sql/production-rls.sql
    A	docs/ASSUMPTIONS.md
    M	docs/EPICS.md
    A	docs/PROGRESS.md
    M	docs/PROJECT_LOGIC.md
    M	docs/STATUS.md
    A	docs/evidence/TASK-252-company-profile-after-desktop.png
    A	docs/evidence/TASK-252-company-profile-after-mobile.png
    A	docs/evidence/TASK-252-company-profile-before-desktop.png
    A	docs/evidence/TASK-252-company-profile-before-mobile.png
    A	docs/evidence/TASK-252-company-profile-edit-desktop.png
    A	docs/evidence/TASK-252-company-profile-edit-mobile.png
    A	docs/evidence/TASK-252-company-profile.md
    A	drizzle/0118_lucky_randall.sql
    A	drizzle/meta/0118_snapshot.json
    M	drizzle/meta/_journal.json
    M	src/api/controlPlane.integration.test.ts
    M	src/api/routes/settings.ts
    A	src/data/schema/companyProfile.ts
    M	src/data/schema/index.ts
    A	src/modules/admin/companyProfile.test.ts
    A	src/modules/admin/companyProfile.ts
    M	src/modules/admin/controlPlane.ts
    M	tasks/tasks.jsonl
    A	tests/e2e/company-profile.spec.mjs
    A	ui/TASK-252-company-profile-proposal.md
    A	ui/TASK-252-company-profile-proposal.svg
    M	web/index.html
    A	web/public/assets/company-profile-ui.css
    A	web/public/assets/company-profile-ui.js
    M	web/public/assets/erp-system-data-adapter.js
    M	web/public/assets/screens-control-plane-canonical.js
    M	web/public/db/erp-system-migrations.sql
    M	web/public/db/erp-system-schema.sql
    M	web/public/sw.js
    M	web/src/erp-demo-runtime-impl.ts

TASK253/254 HR symbols are absent on current main. Their directory/accountless-end and Leave-overlap source and tests are explicitly included; unrelated dirty work is excluded. 0118_classy_ronan was generated from actual main, not a Company Profile snapshot. Populated production lineage review is a separate release gate. No merge, force-push or production change.
