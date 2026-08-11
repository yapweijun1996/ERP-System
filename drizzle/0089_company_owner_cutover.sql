-- TASK-175: replace the tenant-local Superadmin bypass with an explicit Company Owner role.
-- Registered permission rows and company scope are backfilled before legacy
-- assignments are moved. The legacy role column remains for audit history but
-- is no longer interpreted by the application authorization evaluator.

-- Normalize a pre-existing company-scoped role with the canonical owner name.
UPDATE "role"
SET "name" = 'Company Owner',
    "is_superadmin" = false,
    "source_template_key" = 'company_owner',
    "updated_at" = now()
WHERE "company_fn" IS NOT NULL
  AND lower("name") = 'company owner'
  AND "source_template_key" IS DISTINCT FROM 'company_owner';
--> statement-breakpoint

-- Every tenant gets one immutable, company-scoped owner role before any
-- legacy assignment is moved. Existing custom roles are not overwritten.
INSERT INTO "role" (
  "master_fn", "company_fn", "name", "is_superadmin", "source_template_key",
  "created_at", "updated_at"
)
SELECT
  company."master_fn", company."company_fn", 'Company Owner', false, 'company_owner', now(), now()
FROM "company" company
WHERE NOT EXISTS (
  SELECT 1
  FROM "role" owner_role
  WHERE owner_role."master_fn" = company."master_fn"
    AND owner_role."company_fn" = company."company_fn"
    AND owner_role."source_template_key" = 'company_owner'
)
AND NOT EXISTS (
  SELECT 1
  FROM "role" same_name
  WHERE same_name."master_fn" = company."master_fn"
    AND same_name."company_fn" = company."company_fn"
    AND same_name."name" = 'Company Owner'
);
--> statement-breakpoint

-- The bundle is explicit and contains no platform key or automatic approval,
-- payment, payroll, payout, or sensitive tax-evidence authority.
WITH owner_roles AS (
  SELECT "master_fn", "company_fn", "role_id"
  FROM "role"
  WHERE "source_template_key" = 'company_owner'
    AND "company_fn" IS NOT NULL
), owner_permissions(permission_key) AS (
  VALUES
    ('dashboard.read'),
    ('inventory.read'),
    ('inventory.write'),
    ('inventory.adjust'),
    ('inventory.transfer'),
    ('inventory.track'),
    ('warehouse.read'),
    ('sales.read'),
    ('sales.write'),
    ('finance.read'),
    ('finance.write'),
    ('finance.budget.manage'),
    ('finance.report.export'),
    ('purchasing.read'),
    ('purchasing.write'),
    ('crm.read'),
    ('crm.write'),
    ('manufacturing.read'),
    ('manufacturing.write'),
    ('quality.read'),
    ('quality.write'),
    ('asset.read'),
    ('asset.write'),
    ('hr.read'),
    ('hr.write'),
    ('employee.self.read'),
    ('employee.leave.write'),
    ('employee.receipts.write'),
    ('employee.claims.write'),
    ('documents.governance.manage'),
    ('documents.records.manage'),
    ('documents.finance.review'),
    ('expenses.policy.manage'),
    ('expenses.duplicate.override'),
    ('expenses.card.manage'),
    ('expenses.allowance.manage'),
    ('expenses.advance.manage'),
    ('expenses.payment.prepare'),
    ('expenses.payment.template.manage'),
    ('expenses.payment.export'),
    ('expenses.payment.artifact.download'),
    ('expenses.tax_evidence.generate'),
    ('employee.team.read'),
    ('project.read'),
    ('project.write'),
    ('service.read'),
    ('service.write'),
    ('reporting.read'),
    ('integration.read'),
    ('integration.import'),
    ('integration.manage'),
    ('notifications.read'),
    ('notifications.manage'),
    ('session.switch_company'),
    ('admin.audit.read'),
    ('admin.users.invite'),
    ('admin.users.read'),
    ('admin.users.manage'),
    ('admin.roles.read'),
    ('admin.roles.write'),
    ('admin.modules.manage'),
    ('admin.master.read'),
    ('settings.read'),
    ('settings.manage'),
    ('sales.create'),
    ('sales.edit'),
    ('sales.post'),
    ('sales.export'),
    ('purchasing.create'),
    ('purchasing.edit'),
    ('purchasing.post'),
    ('purchasing.export'),
    ('crm.create'),
    ('crm.edit'),
    ('crm.post'),
    ('crm.export'),
    ('inventory.create'),
    ('inventory.edit'),
    ('inventory.post'),
    ('inventory.export'),
    ('warehouse.create'),
    ('warehouse.edit'),
    ('warehouse.post'),
    ('warehouse.export'),
    ('manufacturing.create'),
    ('manufacturing.edit'),
    ('manufacturing.post'),
    ('manufacturing.export'),
    ('quality.create'),
    ('quality.edit'),
    ('quality.post'),
    ('quality.export'),
    ('finance.create'),
    ('finance.edit'),
    ('finance.post'),
    ('finance.export'),
    ('hr.create'),
    ('hr.edit'),
    ('hr.post'),
    ('hr.export'),
    ('project.create'),
    ('project.edit'),
    ('project.post'),
    ('project.export'),
    ('service.create'),
    ('service.edit'),
    ('service.post'),
    ('service.export'),
    ('asset.create'),
    ('asset.edit'),
    ('asset.post'),
    ('asset.export')
)
INSERT INTO "role_permission" ("master_fn", "role_id", "permission_key", "allowed", "created_at", "updated_at")
SELECT owner_roles."master_fn", owner_roles."role_id", owner_permissions.permission_key, true, now(), now()
FROM owner_roles
CROSS JOIN owner_permissions
ON CONFLICT ("role_id", "permission_key") DO UPDATE
SET "allowed" = true, "updated_at" = now();
--> statement-breakpoint

INSERT INTO "role_resource_scope" (
  "master_fn", "company_fn", "role_id", "resource_key", "scope", "created_at", "updated_at"
)
SELECT "master_fn", "company_fn", "role_id", '*', 'company', now(), now()
FROM "role"
WHERE "source_template_key" = 'company_owner'
  AND "company_fn" IS NOT NULL
ON CONFLICT ("role_id", "resource_key") DO UPDATE
SET "scope" = 'company', "updated_at" = now();
--> statement-breakpoint

-- Move every historical assignment that pointed at a legacy Superadmin role
-- onto the same-company Owner role. Assignment identity and validity windows
-- are preserved; only the reusable role reference changes.
UPDATE "user_company_role" assignment
SET "role_id" = owner_role."role_id",
    "assignment_source" = 'legacy_backfill',
    "assignment_reason" = COALESCE(assignment."assignment_reason", 'Migrated legacy Superadmin assignment to Company Owner'),
    "updated_at" = now()
FROM "role" legacy_role
     , "role" owner_role
WHERE assignment."role_id" = legacy_role."role_id"
  AND legacy_role."is_superadmin" = true
  AND owner_role."master_fn" = legacy_role."master_fn"
  AND owner_role."company_fn" = assignment."company_fn"
  AND owner_role."source_template_key" = 'company_owner'
  AND (legacy_role."company_fn" IS NULL OR legacy_role."company_fn" = assignment."company_fn");
--> statement-breakpoint

-- Keep the compatibility/default membership role aligned with the migrated
-- assignment so older integrations cannot silently select the old role.
UPDATE "user_company" membership
SET "role_id" = owner_role."role_id", "updated_at" = now()
FROM "role" legacy_role
     , "role" owner_role
WHERE membership."role_id" = legacy_role."role_id"
  AND legacy_role."is_superadmin" = true
  AND owner_role."master_fn" = legacy_role."master_fn"
  AND owner_role."company_fn" = membership."company_fn"
  AND owner_role."source_template_key" = 'company_owner'
  AND (legacy_role."company_fn" IS NULL OR legacy_role."company_fn" = membership."company_fn");
--> statement-breakpoint

-- Give migrated assignments an explicit company scope. Since TASK-172's
-- assignment rows are already marked backfilled, this row is authoritative.
INSERT INTO "user_company_role_scope" (
  "master_fn", "company_fn", "assignment_id", "resource_key", "scope",
  "target_type", "target_id", "created_at", "updated_at"
)
SELECT owner_role."master_fn", assignment."company_fn", assignment."assignment_id", '*', 'company', 'none', '', now(), now()
FROM "user_company_role" assignment
JOIN "role" owner_role ON owner_role."role_id" = assignment."role_id"
WHERE owner_role."source_template_key" = 'company_owner'
ON CONFLICT ("assignment_id", "resource_key", "target_type", "target_id") DO UPDATE
SET "scope" = 'company', "updated_at" = now();
--> statement-breakpoint

-- Invalidate old effective-capability snapshots for tenants that had the
-- legacy grant. This predicate is evaluated before the flag is removed.
UPDATE "company" company
SET "authorization_version" = "authorization_version" + 1,
    "updated_at" = now()
WHERE EXISTS (
  SELECT 1
  FROM "role" legacy_role
  WHERE legacy_role."master_fn" = company."master_fn"
    AND legacy_role."is_superadmin" = true
    AND (legacy_role."company_fn" IS NULL OR legacy_role."company_fn" = company."company_fn")
);
--> statement-breakpoint

-- Retain old role rows for audit/rollback history, but make them inert to
-- authorization and prevent new code from treating them as administrators.
UPDATE "role"
SET "is_superadmin" = false,
    "source_template_key" = CASE
      WHEN "source_template_key" = 'superadmin' OR "source_template_key" IS NULL
        THEN 'legacy_superadmin'
      ELSE "source_template_key"
    END,
    "updated_at" = now()
WHERE "is_superadmin" = true;
