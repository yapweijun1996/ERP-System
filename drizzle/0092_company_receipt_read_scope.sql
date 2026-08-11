-- TASK-179 expands the permission model before the register route begins using
-- it. Employee/Manager remain uploader-scoped; Finance and Company Owner read
-- the active Company register. Custom roles receive neither grant implicitly.
INSERT INTO "role_permission" (
  "master_fn", "role_id", "permission_key", "allowed", "created_at", "updated_at"
)
SELECT role_row."master_fn", role_row."role_id", grants."permission_key", true, now(), now()
FROM "role" role_row
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN role_row."source_template_key" IN (
        'company_owner', 'finance_preparer', 'finance_checker', 'receipt_manager'
      )
      OR role_row."name" IN ('Company Owner', 'Finance Preparer', 'Finance Checker', 'Receipt Manager')
      THEN 'expenses.company_receipts.read_company'
    WHEN role_row."source_template_key" IN ('employee', 'manager')
      OR role_row."name" IN ('Employee', 'Manager')
      THEN 'expenses.company_receipts.read_own'
    ELSE NULL
  END AS "permission_key"
) grants
WHERE grants."permission_key" IS NOT NULL
ON CONFLICT ("role_id", "permission_key") DO UPDATE
SET "allowed" = true, "updated_at" = now();
--> statement-breakpoint

-- Receipt Manager is a narrow Finance workspace role, so the module shell
-- itself must be discoverable as well as the register action.
INSERT INTO "role_permission" (
  "master_fn", "role_id", "permission_key", "allowed", "created_at", "updated_at"
)
SELECT "master_fn", "role_id", 'finance.read', true, now(), now()
FROM "role"
WHERE "source_template_key" = 'receipt_manager' OR "name" = 'Receipt Manager'
ON CONFLICT ("role_id", "permission_key") DO UPDATE
SET "allowed" = true, "updated_at" = now();
--> statement-breakpoint

-- Existing sessions carry an authorization-version snapshot. Invalidate every
-- Company whose Master contains a role affected by the backfill.
UPDATE "company" company_row
SET "authorization_version" = "authorization_version" + 1,
    "updated_at" = now()
WHERE EXISTS (
  SELECT 1
  FROM "role" role_row
  WHERE role_row."master_fn" = company_row."master_fn"
    AND (
      role_row."source_template_key" IN (
        'company_owner', 'finance_preparer', 'finance_checker', 'receipt_manager', 'employee', 'manager'
      )
      OR role_row."name" IN (
        'Company Owner', 'Finance Preparer', 'Finance Checker', 'Receipt Manager', 'Employee', 'Manager'
      )
    )
);
