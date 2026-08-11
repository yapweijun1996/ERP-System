-- TASK-186: retire tenant-owned Module Access Control authority. The legacy
-- permission codes remain registry-recognized for migration/audit history but
-- are non-assignable and no tenant API evaluates them.

-- Invalidate authorization snapshots before removing active grants.
UPDATE "company" company_row
SET "authorization_version" = "authorization_version" + 1,
    "updated_at" = now()
WHERE EXISTS (
  SELECT 1
  FROM "role" role_row
  JOIN "role_permission" grant_row ON grant_row."role_id" = role_row."role_id"
  WHERE role_row."master_fn" = company_row."master_fn"
    AND (role_row."company_fn" IS NULL OR role_row."company_fn" = company_row."company_fn")
    AND grant_row."permission_key" IN ('admin.modules.manage', 'system.modules.manage')
    AND grant_row."allowed" = true
)
OR EXISTS (
  SELECT 1
  FROM "user_permission_override" override_row
  WHERE override_row."master_fn" = company_row."master_fn"
    AND override_row."company_fn" = company_row."company_fn"
    AND override_row."permission_key" IN ('admin.modules.manage', 'system.modules.manage')
    AND override_row."revoked_at" IS NULL
);
--> statement-breakpoint

DELETE FROM "role_permission"
WHERE "permission_key" IN ('admin.modules.manage', 'system.modules.manage');
--> statement-breakpoint

UPDATE "user_permission_override"
SET "revoked_at" = now(),
    "revoked_by_user_id" = "assigned_by_user_id",
    "revocation_reason" = 'System migration: tenant module authority retired by TASK-186',
    "updated_at" = now()
WHERE "permission_key" IN ('admin.modules.manage', 'system.modules.manage')
  AND "revoked_at" IS NULL;
--> statement-breakpoint

-- Existing setup rows must not remain stranded on the removed tenant module
-- stage. Preserve their relative progress while removing the obsolete marker.
UPDATE "company_onboarding"
SET "current_stage" = CASE WHEN "current_stage" = 'modules' THEN 'roles' ELSE "current_stage" END,
    "completed_steps" = "completed_steps" - 'modules',
    "updated_at" = now()
WHERE "current_stage" = 'modules'
   OR "completed_steps" @> '["modules"]'::jsonb;
