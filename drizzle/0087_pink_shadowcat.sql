CREATE TABLE "user_permission_override" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_permission_override_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"user_id" bigint NOT NULL,
	"permission_key" text NOT NULL,
	"resource_key" text,
	"effect" text NOT NULL,
	"scope" text DEFAULT 'company' NOT NULL,
	"target_type" text DEFAULT 'none' NOT NULL,
	"target_id" text DEFAULT '' NOT NULL,
	"reason" text NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"assigned_by_user_id" bigint NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" bigint,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_user_permission_override_effect" CHECK ("user_permission_override"."effect" in ('allow', 'deny')),
	CONSTRAINT "ck_user_permission_override_scope" CHECK ("user_permission_override"."scope" in ('self', 'team', 'department', 'company')),
	CONSTRAINT "ck_user_permission_override_target_type" CHECK ("user_permission_override"."target_type" in ('none', 'company', 'branch', 'department', 'team', 'employee', 'region', 'business_unit', 'legal_entity', 'cost_center')),
	CONSTRAINT "ck_user_permission_override_target" CHECK (("user_permission_override"."target_type" = 'none' and "user_permission_override"."target_id" = '') or ("user_permission_override"."target_type" <> 'none' and char_length("user_permission_override"."target_id") > 0)),
	CONSTRAINT "ck_user_permission_override_window" CHECK ("user_permission_override"."valid_until" is null or "user_permission_override"."valid_until" > "user_permission_override"."valid_from"),
	CONSTRAINT "ck_user_permission_override_revocation" CHECK (("user_permission_override"."revoked_at" is null and "user_permission_override"."revoked_by_user_id" is null and "user_permission_override"."revocation_reason" is null)
      or ("user_permission_override"."revoked_at" is not null and "user_permission_override"."revoked_by_user_id" is not null and "user_permission_override"."revocation_reason" is not null))
);
--> statement-breakpoint
/*
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'user_company_role'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually

    Hope to release this update as soon as possible
*/

-- ALTER TABLE "user_company_role" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "user_permission_override" ADD CONSTRAINT "user_permission_override_user_id_app_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_override" ADD CONSTRAINT "user_permission_override_assigned_by_user_id_app_user_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_override" ADD CONSTRAINT "user_permission_override_revoked_by_user_id_app_user_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_override" ADD CONSTRAINT "fk_user_permission_override_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_override" ADD CONSTRAINT "fk_user_permission_override_membership" FOREIGN KEY ("user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_permission_override_lookup" ON "user_permission_override" USING btree ("master_fn","company_fn","user_id","permission_key","effect","valid_from","valid_until");--> statement-breakpoint
CREATE INDEX "idx_user_permission_override_resource" ON "user_permission_override" USING btree ("master_fn","company_fn","resource_key","scope","target_type","target_id");
