CREATE TABLE "employee_account_handoff" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_account_handoff_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"source_employee_id" bigint NOT NULL,
	"source_user_id" bigint NOT NULL,
	"target_employee_id" bigint NOT NULL,
	"target_user_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"direct_reports_transferred" integer DEFAULT 0 NOT NULL,
	"customers_transferred" integer DEFAULT 0 NOT NULL,
	"opportunities_transferred" integer DEFAULT 0 NOT NULL,
	"notifications_transferred" integer DEFAULT 0 NOT NULL,
	"performed_by_user_id" bigint NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_employee_account_handoff_reason" CHECK (char_length(trim("employee_account_handoff"."reason")) between 3 and 500),
	CONSTRAINT "ck_employee_account_handoff_counts" CHECK (
    "employee_account_handoff"."direct_reports_transferred" >= 0
    and "employee_account_handoff"."customers_transferred" >= 0
    and "employee_account_handoff"."opportunities_transferred" >= 0
    and "employee_account_handoff"."notifications_transferred" >= 0
  )
);
--> statement-breakpoint
CREATE TABLE "employee_activation_secret" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_activation_secret_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"employee_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"purpose" text NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"credential_envelope" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"cleared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_employee_activation_secret_purpose" CHECK ("employee_activation_secret"."purpose" in ('activation', 'reset')),
	CONSTRAINT "ck_employee_activation_secret_generation" CHECK ("employee_activation_secret"."generation" > 0)
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "account_state" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "password_change_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "offboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "user_id" bigint;--> statement-breakpoint
ALTER TABLE "employee_account_handoff" ADD CONSTRAINT "employee_account_handoff_source_employee_id_employee_id_fk" FOREIGN KEY ("source_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_account_handoff" ADD CONSTRAINT "employee_account_handoff_source_user_id_app_user_user_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_account_handoff" ADD CONSTRAINT "employee_account_handoff_target_employee_id_employee_id_fk" FOREIGN KEY ("target_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_account_handoff" ADD CONSTRAINT "employee_account_handoff_target_user_id_app_user_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_account_handoff" ADD CONSTRAINT "employee_account_handoff_performed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_activation_secret" ADD CONSTRAINT "employee_activation_secret_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_activation_secret" ADD CONSTRAINT "employee_activation_secret_user_id_app_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_activation_secret" ADD CONSTRAINT "employee_activation_secret_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employee_account_handoff_source" ON "employee_account_handoff" USING btree ("master_fn","company_fn","source_employee_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_employee_activation_secret_active" ON "employee_activation_secret" USING btree ("master_fn","company_fn","user_id") WHERE "employee_activation_secret"."cleared_at" is null;--> statement-breakpoint
CREATE INDEX "idx_employee_activation_secret_employee" ON "employee_activation_secret" USING btree ("master_fn","company_fn","employee_id","id");--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_user_id_app_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_employee_company_user" ON "employee" USING btree ("master_fn","company_fn","user_id") WHERE "employee"."user_id" is not null;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "ck_app_user_account_state" CHECK ("app_user"."account_state" in ('preactivated', 'active', 'offboarded'));
--> statement-breakpoint
INSERT INTO "role" ("master_fn", "name", "is_superadmin", "created_at", "updated_at")
SELECT "master_fn", 'Employee', false, now(), now()
FROM "master"
ON CONFLICT ("master_fn", "name") DO NOTHING;
