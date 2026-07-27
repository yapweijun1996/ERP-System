CREATE TABLE "company_module" (
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"module_key" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"configured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_module_master_fn_company_fn_module_key_pk" PRIMARY KEY("master_fn","company_fn","module_key")
);
--> statement-breakpoint
CREATE TABLE "company_onboarding" (
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"status" text DEFAULT 'setup' NOT NULL,
	"current_stage" text DEFAULT 'company' NOT NULL,
	"completed_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"go_live_at" timestamp with time zone,
	"go_live_by_user_id" bigint,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_onboarding_master_fn_company_fn_pk" PRIMARY KEY("master_fn","company_fn"),
	CONSTRAINT "ck_company_onboarding_status" CHECK ("company_onboarding"."status" in ('setup', 'live')),
	CONSTRAINT "ck_company_onboarding_stage" CHECK ("company_onboarding"."current_stage" in (
    'company', 'fiscal', 'warehouse', 'modules', 'roles', 'staff',
    'import', 'opening_balance', 'uat', 'live'
  ))
);
--> statement-breakpoint
CREATE TABLE "onboarding_import_job" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "onboarding_import_job_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"target" text NOT NULL,
	"format" text NOT NULL,
	"file_name" text NOT NULL,
	"source_hash" text NOT NULL,
	"status" text DEFAULT 'validated' NOT NULL,
	"total_rows" integer NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"warning_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"committed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_onboarding_import_format" CHECK ("onboarding_import_job"."format" in ('csv', 'xlsx')),
	CONSTRAINT "ck_onboarding_import_status" CHECK ("onboarding_import_job"."status" in ('validated', 'invalid', 'committed', 'failed')),
	CONSTRAINT "ck_onboarding_import_counts" CHECK (
    "onboarding_import_job"."total_rows" >= 0 and "onboarding_import_job"."error_rows" >= 0 and "onboarding_import_job"."warning_rows" >= 0 and "onboarding_import_job"."imported_rows" >= 0
  )
);
--> statement-breakpoint
CREATE TABLE "onboarding_import_row" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "onboarding_import_row_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"job_id" bigint NOT NULL,
	"row_number" integer NOT NULL,
	"normalized_data" jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_onboarding_import_row_number" CHECK ("onboarding_import_row"."row_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "role_resource_scope" (
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"role_id" bigint NOT NULL,
	"resource_key" text NOT NULL,
	"scope" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_resource_scope_role_id_resource_key_pk" PRIMARY KEY("role_id","resource_key"),
	CONSTRAINT "ck_role_resource_scope_value" CHECK ("role_resource_scope"."scope" in ('self', 'team', 'department', 'company'))
);
--> statement-breakpoint
CREATE TABLE "staff_onboarding_draft" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "staff_onboarding_draft_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"employee_data" jsonb NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"role_ids" jsonb NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"activated_user_id" bigint,
	"activated_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_staff_onboarding_status" CHECK ("staff_onboarding_draft"."status" in ('draft', 'activated', 'cancelled')),
	CONSTRAINT "ck_staff_onboarding_version" CHECK ("staff_onboarding_draft"."version" > 0)
);
--> statement-breakpoint
DROP INDEX "uq_role_master_name";--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "initial_password_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "role" ADD COLUMN "company_fn" text;--> statement-breakpoint
ALTER TABLE "role" ADD COLUMN "source_template_key" text;--> statement-breakpoint
-- Expand legacy master-wide roles into one assignable role per company without
-- deleting the legacy rows. Pending invitations and both assignment tables are
-- repointed before application reads switch to company-scoped roles.
INSERT INTO "role" (
  "master_fn", "company_fn", "name", "is_superadmin", "source_template_key",
  "created_at", "updated_at"
)
SELECT DISTINCT
  legacy."master_fn", assignment."company_fn", legacy."name", legacy."is_superadmin",
  lower(replace(legacy."name", ' ', '_')), legacy."created_at", now()
FROM "role" legacy
JOIN "user_company_role" assignment ON assignment."role_id" = legacy."role_id"
WHERE legacy."company_fn" IS NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permission" (
  "master_fn", "role_id", "permission_key", "allowed", "created_at", "updated_at"
)
SELECT old_permission."master_fn", company_role."role_id",
       old_permission."permission_key", old_permission."allowed",
       old_permission."created_at", now()
FROM "role_permission" old_permission
JOIN "role" legacy ON legacy."role_id" = old_permission."role_id"
JOIN "role" company_role
  ON company_role."master_fn" = legacy."master_fn"
 AND company_role."name" = legacy."name"
 AND company_role."company_fn" IS NOT NULL
WHERE legacy."company_fn" IS NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_resource_scope" (
  "master_fn", "company_fn", "role_id", "resource_key", "scope"
)
SELECT company_role."master_fn", company_role."company_fn", company_role."role_id", '*', 'company'
FROM "role" company_role
WHERE company_role."company_fn" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "user_company_role" assignment
SET "role_id" = company_role."role_id", "updated_at" = now()
FROM "role" legacy, "role" company_role
WHERE assignment."role_id" = legacy."role_id"
  AND legacy."company_fn" IS NULL
  AND company_role."master_fn" = legacy."master_fn"
  AND company_role."company_fn" = assignment."company_fn"
  AND company_role."name" = legacy."name";--> statement-breakpoint
UPDATE "user_company" membership
SET "role_id" = company_role."role_id", "updated_at" = now()
FROM "role" legacy, "role" company_role
WHERE membership."role_id" = legacy."role_id"
  AND legacy."company_fn" IS NULL
  AND company_role."master_fn" = legacy."master_fn"
  AND company_role."company_fn" = membership."company_fn"
  AND company_role."name" = legacy."name";--> statement-breakpoint
UPDATE "user_invitation" invitation
SET "role_id" = company_role."role_id", "updated_at" = now()
FROM "role" legacy, "role" company_role
WHERE invitation."role_id" = legacy."role_id"
  AND legacy."company_fn" IS NULL
  AND company_role."master_fn" = legacy."master_fn"
  AND company_role."company_fn" = invitation."company_fn"
  AND company_role."name" = legacy."name";--> statement-breakpoint
-- Existing companies stay live and preserve the effective legacy module state.
INSERT INTO "company_onboarding" (
  "master_fn", "company_fn", "status", "current_stage", "completed_steps",
  "go_live_at", "version"
)
SELECT "master_fn", "company_fn", 'live', 'live',
       '["company","fiscal","warehouse","modules","roles","staff","import","opening_balance","uat"]'::jsonb,
       now(), 1
FROM "company"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "company_module" (
  "master_fn", "company_fn", "module_key", "enabled", "configured"
)
SELECT company."master_fn", company."company_fn", module."module_key",
       coalesce(legacy."enabled", true), true
FROM "company"
CROSS JOIN (VALUES
  ('sales'), ('purchasing'), ('crm'), ('inventory'), ('warehouse'),
  ('manufacturing'), ('quality'), ('finance'), ('hr'), ('project'),
  ('service'), ('asset'), ('workflow'), ('bi'), ('admin'), ('integration')
) AS module("module_key")
LEFT JOIN "master_module" legacy
  ON legacy."master_fn" = company."master_fn"
 AND legacy."module_key" = module."module_key"
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "company_onboarding" ADD CONSTRAINT "company_onboarding_go_live_by_user_id_app_user_user_id_fk" FOREIGN KEY ("go_live_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_import_job" ADD CONSTRAINT "onboarding_import_job_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_import_row" ADD CONSTRAINT "onboarding_import_row_job_id_onboarding_import_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."onboarding_import_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_resource_scope" ADD CONSTRAINT "role_resource_scope_role_id_role_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("role_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_onboarding_draft" ADD CONSTRAINT "staff_onboarding_draft_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_onboarding_draft" ADD CONSTRAINT "staff_onboarding_draft_activated_user_id_app_user_user_id_fk" FOREIGN KEY ("activated_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_company_module_state" ON "company_module" USING btree ("master_fn","company_fn","enabled","module_key");--> statement-breakpoint
CREATE INDEX "idx_company_onboarding_status" ON "company_onboarding" USING btree ("master_fn","status","company_fn");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_onboarding_import_source" ON "onboarding_import_job" USING btree ("master_fn","company_fn","target","source_hash");--> statement-breakpoint
CREATE INDEX "idx_onboarding_import_status" ON "onboarding_import_job" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_onboarding_import_row" ON "onboarding_import_row" USING btree ("master_fn","company_fn","job_id","row_number");--> statement-breakpoint
CREATE INDEX "idx_onboarding_import_row_job" ON "onboarding_import_row" USING btree ("master_fn","company_fn","job_id","id");--> statement-breakpoint
CREATE INDEX "idx_role_resource_scope_tenant" ON "role_resource_scope" USING btree ("master_fn","company_fn","resource_key","scope","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_onboarding_username_active" ON "staff_onboarding_draft" USING btree ("master_fn","company_fn","username") WHERE "staff_onboarding_draft"."status" = 'draft';--> statement-breakpoint
CREATE INDEX "idx_staff_onboarding_status" ON "staff_onboarding_draft" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_company_fn_company_company_fn_fk" FOREIGN KEY ("company_fn") REFERENCES "public"."company"("company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_role_company_name" ON "role" USING btree ("master_fn","company_fn","name");--> statement-breakpoint
CREATE INDEX "idx_role_company" ON "role" USING btree ("master_fn","company_fn","role_id");
