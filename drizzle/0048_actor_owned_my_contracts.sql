CREATE TABLE "employee_hierarchy_scope" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_hierarchy_scope_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"grantee_employee_id" bigint NOT NULL,
	"scope_root_employee_id" bigint NOT NULL,
	"scope_type" text DEFAULT 'direct' NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"granted_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_employee_hierarchy_scope_type" CHECK ("employee_hierarchy_scope"."scope_type" in ('direct', 'tree')),
	CONSTRAINT "ck_employee_hierarchy_scope_dates" CHECK ("employee_hierarchy_scope"."valid_to" is null or "employee_hierarchy_scope"."valid_to" >= "employee_hierarchy_scope"."valid_from"),
	CONSTRAINT "ck_employee_hierarchy_scope_distinct" CHECK ("employee_hierarchy_scope"."grantee_employee_id" <> "employee_hierarchy_scope"."scope_root_employee_id")
);
--> statement-breakpoint
ALTER TABLE "employee_hierarchy_scope" ADD CONSTRAINT "employee_hierarchy_scope_grantee_employee_id_employee_id_fk" FOREIGN KEY ("grantee_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_hierarchy_scope" ADD CONSTRAINT "employee_hierarchy_scope_scope_root_employee_id_employee_id_fk" FOREIGN KEY ("scope_root_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_hierarchy_scope" ADD CONSTRAINT "employee_hierarchy_scope_granted_by_user_id_app_user_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employee_hierarchy_scope_grantee" ON "employee_hierarchy_scope" USING btree ("master_fn","company_fn","grantee_employee_id","valid_from","valid_to");
--> statement-breakpoint
INSERT INTO "role" ("master_fn", "name", "is_superadmin", "created_at", "updated_at")
SELECT "master_fn", 'Manager', false, now(), now()
FROM "master"
ON CONFLICT ("master_fn", "name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permission" ("master_fn", "role_id", "permission_key", "allowed", "created_at", "updated_at")
SELECT r."master_fn", r."role_id", p."permission_key", true, now(), now()
FROM "role" r
CROSS JOIN (
  VALUES
    ('Employee', 'employee.self.read'),
    ('Manager', 'employee.self.read'),
    ('Manager', 'employee.team.read')
) AS p("role_name", "permission_key")
WHERE r."name" = p."role_name"
ON CONFLICT ("role_id", "permission_key") DO UPDATE SET
  "allowed" = true,
  "updated_at" = now();
