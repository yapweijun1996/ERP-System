-- TASK-182 removes Company Receipt mutations from the broad My Receipts
-- compatibility grant. Preserve existing authorized receipt contributors by
-- backfilling the three explicit Company Receipt permissions atomically.
INSERT INTO "role_permission" (
  "master_fn", "role_id", "permission_key", "allowed", "created_at", "updated_at"
)
SELECT grant_row."master_fn", grant_row."role_id", permissions."permission_key", true, now(), now()
FROM "role_permission" grant_row
CROSS JOIN LATERAL (
  VALUES
    ('expenses.company_receipts.create'),
    ('expenses.company_receipts.edit'),
    ('expenses.company_receipts.void')
) AS permissions(permission_key)
WHERE grant_row."permission_key" = 'employee.receipts.write'
  AND grant_row."allowed" = true
ON CONFLICT ("role_id", "permission_key") DO UPDATE
SET "allowed" = true, "updated_at" = now();
--> statement-breakpoint

-- A new receipt permission changes the effective capability snapshot for any
-- Company containing an affected role, so stale sessions must refresh before
-- acting with it.
UPDATE "company" company_row
SET "authorization_version" = "authorization_version" + 1,
    "updated_at" = now()
WHERE EXISTS (
  SELECT 1
  FROM "role" role_row
  JOIN "role_permission" grant_row ON grant_row."role_id" = role_row."role_id"
  WHERE role_row."master_fn" = company_row."master_fn"
    AND (role_row."company_fn" IS NULL OR role_row."company_fn" = company_row."company_fn")
    AND grant_row."permission_key" IN (
      'expenses.company_receipts.create',
      'expenses.company_receipts.edit',
      'expenses.company_receipts.void'
    )
    AND grant_row."allowed" = true
);
