CREATE TABLE "hr_business_unit" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hr_business_unit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_hr_business_unit_version" CHECK ("hr_business_unit"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "hr_position" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hr_position_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_hr_position_version" CHECK ("hr_position"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "role_resource_scope" DROP CONSTRAINT "ck_role_resource_scope_value";--> statement-breakpoint
ALTER TABLE "user_company_role_scope" DROP CONSTRAINT "ck_user_company_role_scope_value";--> statement-breakpoint
ALTER TABLE "user_permission_override" DROP CONSTRAINT "ck_user_permission_override_scope";--> statement-breakpoint
ALTER TABLE "user_permission_override" DROP CONSTRAINT "ck_user_permission_override_target_type";--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "organization_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "business_unit_id" bigint;--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "position_id" bigint;--> statement-breakpoint
ALTER TABLE "hr_business_unit" ADD CONSTRAINT "fk_hr_business_unit_company" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_position" ADD CONSTRAINT "fk_hr_position_company" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_hr_business_unit_code" ON "hr_business_unit" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_hr_business_unit_tenant_id" ON "hr_business_unit" USING btree ("master_fn","company_fn","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_hr_position_code" ON "hr_position" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_hr_position_tenant_id" ON "hr_position" USING btree ("master_fn","company_fn","id");--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "fk_employee_business_unit_tenant" FOREIGN KEY ("master_fn","company_fn","business_unit_id") REFERENCES "public"."hr_business_unit"("master_fn","company_fn","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "fk_employee_position_tenant" FOREIGN KEY ("master_fn","company_fn","position_id") REFERENCES "public"."hr_position"("master_fn","company_fn","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_resource_scope" ADD CONSTRAINT "ck_role_resource_scope_value" CHECK ("role_resource_scope"."scope" in ('self', 'team', 'department', 'business_unit', 'position', 'company'));--> statement-breakpoint
ALTER TABLE "user_company_role_scope" ADD CONSTRAINT "ck_user_company_role_scope_value" CHECK ("user_company_role_scope"."scope" in ('self', 'team', 'department', 'business_unit', 'position', 'company'));--> statement-breakpoint
ALTER TABLE "user_permission_override" ADD CONSTRAINT "ck_user_permission_override_scope" CHECK ("user_permission_override"."scope" in ('self', 'team', 'department', 'business_unit', 'position', 'company'));--> statement-breakpoint
ALTER TABLE "user_permission_override" ADD CONSTRAINT "ck_user_permission_override_target_type" CHECK ("user_permission_override"."target_type" in ('none', 'company', 'branch', 'department', 'team', 'employee', 'region', 'business_unit', 'position', 'legal_entity', 'cost_center'));