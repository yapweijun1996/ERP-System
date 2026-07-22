-- TASK-066 upgrade compatibility: TASK-058 added account 1000 to seed/setup but
-- existing tenants only run migrations. Backfill it once per company without
-- changing any tenant that already configured the code.
INSERT INTO "account" ("master_fn", "company_fn", "code", "name", "type")
SELECT "master_fn", "company_fn", '1000', 'Cash & Bank', 'asset'
FROM "company"
ON CONFLICT ("master_fn", "company_fn", "code") DO NOTHING;
