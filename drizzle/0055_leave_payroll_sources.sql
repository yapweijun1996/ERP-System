CREATE TABLE "payroll_leave_source" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payroll_leave_source_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"employee_id" bigint NOT NULL,
	"leave_request_id" bigint,
	"leave_revision_no" integer,
	"leave_balance_entry_id" bigint,
	"source_type" text NOT NULL,
	"effect_direction" text NOT NULL,
	"source_key" text NOT NULL,
	"days" numeric(8, 2) NOT NULL,
	"base_salary_snapshot" numeric(18, 2) NOT NULL,
	"divisor_days" numeric(8, 2) DEFAULT '26' NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"created_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_payroll_leave_source_type" CHECK ("payroll_leave_source"."source_type" in ('unpaid_leave', 'unpaid_leave_cancellation', 'encashment')),
	CONSTRAINT "ck_payroll_leave_source_direction" CHECK ("payroll_leave_source"."effect_direction" in ('earning', 'deduction')),
	CONSTRAINT "ck_payroll_leave_source_values" CHECK ("payroll_leave_source"."days" > 0 and mod("payroll_leave_source"."days" * 2, 1) = 0
      and "payroll_leave_source"."base_salary_snapshot" >= 0 and "payroll_leave_source"."divisor_days" > 0 and "payroll_leave_source"."amount" >= 0),
	CONSTRAINT "ck_payroll_leave_source_link" CHECK ((
      "payroll_leave_source"."source_type" in ('unpaid_leave', 'unpaid_leave_cancellation')
      and "payroll_leave_source"."leave_request_id" is not null and "payroll_leave_source"."leave_revision_no" > 0
      and "payroll_leave_source"."leave_balance_entry_id" is null
    ) or (
      "payroll_leave_source"."source_type" = 'encashment'
      and "payroll_leave_source"."leave_request_id" is null and "payroll_leave_source"."leave_revision_no" is null
      and "payroll_leave_source"."leave_balance_entry_id" is not null
    ))
);
--> statement-breakpoint
CREATE TABLE "payroll_run_leave_source" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payroll_run_leave_source_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"run_id" bigint NOT NULL,
	"run_line_id" bigint NOT NULL,
	"source_id" bigint NOT NULL,
	"effect_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_run_line" DROP CONSTRAINT "ck_payroll_run_line_amounts";--> statement-breakpoint
ALTER TABLE "payroll_run_line" ADD COLUMN "base_gross_pay" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_run_line" ADD COLUMN "leave_earnings" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_run_line" ADD COLUMN "leave_deductions" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
UPDATE "payroll_run_line"
SET "base_gross_pay" = "gross_pay"
WHERE "base_gross_pay" = 0;--> statement-breakpoint
ALTER TABLE "payroll_leave_source" ADD CONSTRAINT "payroll_leave_source_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_leave_source" ADD CONSTRAINT "payroll_leave_source_leave_request_id_leave_request_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_leave_source" ADD CONSTRAINT "payroll_leave_source_leave_balance_entry_id_leave_balance_entry_id_fk" FOREIGN KEY ("leave_balance_entry_id") REFERENCES "public"."leave_balance_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_leave_source" ADD CONSTRAINT "payroll_leave_source_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_leave_source" ADD CONSTRAINT "payroll_run_leave_source_run_id_payroll_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_leave_source" ADD CONSTRAINT "payroll_run_leave_source_run_line_id_payroll_run_line_id_fk" FOREIGN KEY ("run_line_id") REFERENCES "public"."payroll_run_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_leave_source" ADD CONSTRAINT "payroll_run_leave_source_source_id_payroll_leave_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."payroll_leave_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payroll_leave_source_key" ON "payroll_leave_source" USING btree ("master_fn","company_fn","source_key");--> statement-breakpoint
CREATE INDEX "idx_payroll_leave_source_period" ON "payroll_leave_source" USING btree ("master_fn","company_fn","effective_date","employee_id","id");--> statement-breakpoint
CREATE INDEX "idx_payroll_leave_source_request" ON "payroll_leave_source" USING btree ("master_fn","company_fn","leave_request_id","leave_revision_no","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payroll_run_leave_source" ON "payroll_run_leave_source" USING btree ("master_fn","company_fn","source_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_run_leave_source_run" ON "payroll_run_leave_source" USING btree ("master_fn","company_fn","run_id","run_line_id");--> statement-breakpoint
ALTER TABLE "payroll_run_line" ADD CONSTRAINT "ck_payroll_run_line_amounts" CHECK ("payroll_run_line"."base_gross_pay" >= 0 and "payroll_run_line"."leave_earnings" >= 0 and "payroll_run_line"."leave_deductions" >= 0
      and "payroll_run_line"."gross_pay" >= 0 and "payroll_run_line"."employee_statutory_deduction" >= 0 and "payroll_run_line"."income_tax_deduction" >= 0
      and "payroll_run_line"."employer_statutory_contribution" >= 0 and "payroll_run_line"."employer_additional_contribution" >= 0 and "payroll_run_line"."net_pay" >= 0);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_payroll_leave_fact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'payroll leave facts are append-only';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS payroll_leave_source_append_only ON "payroll_leave_source";
--> statement-breakpoint
CREATE TRIGGER payroll_leave_source_append_only
BEFORE UPDATE OR DELETE ON "payroll_leave_source"
FOR EACH ROW
EXECUTE FUNCTION prevent_payroll_leave_fact_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS payroll_run_leave_source_append_only ON "payroll_run_leave_source";
--> statement-breakpoint
CREATE TRIGGER payroll_run_leave_source_append_only
BEFORE UPDATE OR DELETE ON "payroll_run_leave_source"
FOR EACH ROW
EXECUTE FUNCTION prevent_payroll_leave_fact_mutation();
