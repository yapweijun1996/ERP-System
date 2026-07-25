ALTER TABLE "user_company_role" ADD COLUMN "managed_by_system" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
INSERT INTO "user_company_role" (
  "user_id", "company_fn", "role_id", "managed_by_system", "created_at", "updated_at"
)
SELECT
  manager."user_id",
  manager."company_fn",
  manager_role."role_id",
  true,
  now(),
  now()
FROM "employee" manager
JOIN "app_user" manager_user
  ON manager_user."user_id" = manager."user_id"
 AND manager_user."master_fn" = manager."master_fn"
JOIN "user_company" membership
  ON membership."user_id" = manager."user_id"
 AND membership."company_fn" = manager."company_fn"
JOIN "role" manager_role
  ON manager_role."master_fn" = manager."master_fn"
 AND manager_role."name" = 'Manager'
WHERE manager."is_active" = true
  AND manager_user."is_active" = true
  AND EXISTS (
    SELECT 1
    FROM "employee" report
    WHERE report."master_fn" = manager."master_fn"
      AND report."company_fn" = manager."company_fn"
      AND report."manager_id" = manager."id"
      AND report."is_active" = true
  )
ON CONFLICT ("user_id", "company_fn", "role_id") DO NOTHING;
