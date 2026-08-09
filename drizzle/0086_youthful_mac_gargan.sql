CREATE TABLE "user_company_role_scope" (
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"assignment_id" bigint NOT NULL,
	"resource_key" text NOT NULL,
	"scope" text NOT NULL,
	"target_type" text DEFAULT 'none' NOT NULL,
	"target_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_company_role_scope_assignment_id_resource_key_target_type_target_id_pk" PRIMARY KEY("assignment_id","resource_key","target_type","target_id"),
	CONSTRAINT "ck_user_company_role_scope_value" CHECK ("user_company_role_scope"."scope" in ('self', 'team', 'department', 'company')),
	CONSTRAINT "ck_user_company_role_scope_target" CHECK (("user_company_role_scope"."target_type" = 'none' and "user_company_role_scope"."target_id" = '') or ("user_company_role_scope"."target_type" <> 'none' and char_length("user_company_role_scope"."target_id") > 0))
);
--> statement-breakpoint
ALTER TABLE "user_company_role" ADD COLUMN "assignment_id" bigint NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "user_company_role_assignment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_company_role" ADD COLUMN "valid_from" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD COLUMN "assigned_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD COLUMN "assignment_source" text DEFAULT 'legacy_backfill' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD COLUMN "assignment_reason" text;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD COLUMN "revoked_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD COLUMN "revocation_reason" text;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD COLUMN "scope_backfilled_at" timestamp with time zone;--> statement-breakpoint
-- The surrogate assignment id is now authoritative. Existing composite-key
-- lookup code remains valid, but it no longer prevents multiple independent
-- assignments for the same principal/role.
ALTER TABLE "user_company_role" DROP CONSTRAINT IF EXISTS "user_company_role_user_id_company_fn_role_id_pk";--> statement-breakpoint
ALTER TABLE "user_company_role" ADD CONSTRAINT "user_company_role_assignment_id_pk" PRIMARY KEY ("assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_company_role_assignment_id" ON "user_company_role" USING btree ("assignment_id");--> statement-breakpoint
ALTER TABLE "user_company_role_scope" ADD CONSTRAINT "user_company_role_scope_assignment_id_user_company_role_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."user_company_role"("assignment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_company_role_scope_tenant" ON "user_company_role_scope" USING btree ("master_fn","company_fn","resource_key","scope","target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_user_company_role_scope_assignment" ON "user_company_role_scope" USING btree ("assignment_id","resource_key");--> statement-breakpoint
ALTER TABLE "user_company_role" ADD CONSTRAINT "user_company_role_assigned_by_user_id_app_user_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_role" ADD CONSTRAINT "user_company_role_revoked_by_user_id_app_user_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_company_role_active" ON "user_company_role" USING btree ("company_fn","user_id","valid_from","valid_until","revoked_at");--> statement-breakpoint
ALTER TABLE "user_company_role" ADD CONSTRAINT "ck_user_company_role_valid_window" CHECK ("user_company_role"."valid_until" is null or "user_company_role"."valid_until" > "user_company_role"."valid_from");--> statement-breakpoint
ALTER TABLE "user_company_role" ADD CONSTRAINT "ck_user_company_role_assignment_source" CHECK ("user_company_role"."assignment_source" in ('manual', 'system', 'invitation', 'onboarding', 'legacy_backfill'));--> statement-breakpoint
-- Preserve the original effective start for legacy assignments; newly
-- inserted assignments continue to use the default current timestamp.
UPDATE "user_company_role"
SET "valid_from" = "created_at"
WHERE "valid_from" > "created_at";--> statement-breakpoint
-- Expand/backfill: copy every existing role-level scope to each stable
-- assignment before the application reads assignment-owned scopes. The
-- `none` target preserves the legacy actor-relative semantics; a future
-- target row can be added without duplicating the reusable role.
INSERT INTO "user_company_role_scope" (
  "master_fn", "company_fn", "assignment_id", "resource_key", "scope",
  "target_type", "target_id", "created_at", "updated_at"
)
SELECT
  role."master_fn", assignment."company_fn", assignment."assignment_id",
  legacy_scope."resource_key", legacy_scope."scope", 'none', '', now(), now()
FROM "user_company_role" assignment
JOIN "role" role
  ON role."role_id" = assignment."role_id"
JOIN "role_resource_scope" legacy_scope
  ON legacy_scope."role_id" = assignment."role_id"
 AND legacy_scope."master_fn" = role."master_fn"
 AND legacy_scope."company_fn" = assignment."company_fn"
ON CONFLICT ("assignment_id", "resource_key", "target_type", "target_id") DO NOTHING;--> statement-breakpoint
UPDATE "user_company_role"
SET "scope_backfilled_at" = now(), "updated_at" = now()
WHERE "scope_backfilled_at" IS NULL;
