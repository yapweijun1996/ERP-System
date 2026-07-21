CREATE TABLE "payroll_run" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payroll_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pay_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_gross_pay" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_net_pay" numeric(18, 2) DEFAULT '0' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_payroll_run_status" CHECK ("payroll_run"."status" in ('draft', 'posted', 'cancelled')),
	CONSTRAINT "ck_payroll_run_dates" CHECK ("payroll_run"."period_end" >= "payroll_run"."period_start")
);
--> statement-breakpoint
CREATE TABLE "payroll_run_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payroll_run_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"run_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"employee_id" bigint NOT NULL,
	"gross_pay" numeric(18, 2) NOT NULL,
	"employee_statutory_deduction" numeric(18, 2) NOT NULL,
	"income_tax_deduction" numeric(18, 2) NOT NULL,
	"employer_statutory_contribution" numeric(18, 2) NOT NULL,
	"employer_additional_contribution" numeric(18, 2) NOT NULL,
	"net_pay" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_payroll_run_line_amounts" CHECK ("payroll_run_line"."gross_pay" >= 0 and "payroll_run_line"."employee_statutory_deduction" >= 0 and "payroll_run_line"."income_tax_deduction" >= 0
      and "payroll_run_line"."employer_statutory_contribution" >= 0 and "payroll_run_line"."employer_additional_contribution" >= 0 and "payroll_run_line"."net_pay" >= 0)
);
--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "base_salary" numeric(18, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_run_line" ADD CONSTRAINT "payroll_run_line_run_id_payroll_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_line" ADD CONSTRAINT "payroll_run_line_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payroll_run_docno" ON "payroll_run" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_payroll_run_period" ON "payroll_run" USING btree ("master_fn","company_fn","period_start","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payroll_run_line" ON "payroll_run_line" USING btree ("master_fn","company_fn","run_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_payroll_run_line_employee" ON "payroll_run_line" USING btree ("master_fn","company_fn","employee_id","run_id");--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "ck_employee_base_salary" CHECK ("employee"."base_salary" > 0);