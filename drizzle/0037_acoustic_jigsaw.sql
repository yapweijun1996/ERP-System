CREATE TABLE "sales_commission_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_commission_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"run_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"plan_id" bigint NOT NULL,
	"salesperson_user_id" bigint NOT NULL,
	"salesperson_name" text NOT NULL,
	"basis" text NOT NULL,
	"rate_pct" numeric(6, 3) NOT NULL,
	"gross_invoice_revenue" numeric(18, 2) DEFAULT '0' NOT NULL,
	"credit_revenue" numeric(18, 2) DEFAULT '0' NOT NULL,
	"debit_revenue" numeric(18, 2) DEFAULT '0' NOT NULL,
	"eligible_revenue" numeric(18, 2) NOT NULL,
	"commission_amount" numeric(18, 2) NOT NULL,
	"source_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_commission_line_basis" CHECK ("sales_commission_line"."basis" in ('recognized_revenue')),
	CONSTRAINT "ck_sales_commission_line_rate" CHECK ("sales_commission_line"."rate_pct" > 0 and "sales_commission_line"."rate_pct" <= 100),
	CONSTRAINT "ck_sales_commission_line_amounts" CHECK ("sales_commission_line"."gross_invoice_revenue" >= 0 and "sales_commission_line"."credit_revenue" >= 0
      and "sales_commission_line"."debit_revenue" >= 0 and "sales_commission_line"."source_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "sales_commission_plan" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_commission_plan_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"salesperson_user_id" bigint NOT NULL,
	"basis" text DEFAULT 'recognized_revenue' NOT NULL,
	"rate_pct" numeric(6, 3) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_commission_plan_basis" CHECK ("sales_commission_plan"."basis" in ('recognized_revenue')),
	CONSTRAINT "ck_sales_commission_plan_status" CHECK ("sales_commission_plan"."status" in ('draft', 'active', 'inactive')),
	CONSTRAINT "ck_sales_commission_plan_rate" CHECK ("sales_commission_plan"."rate_pct" > 0 and "sales_commission_plan"."rate_pct" <= 100),
	CONSTRAINT "ck_sales_commission_plan_dates" CHECK ("sales_commission_plan"."effective_to" is null or "sales_commission_plan"."effective_to" >= "sales_commission_plan"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "sales_commission_run" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_commission_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"gross_invoice_revenue" numeric(18, 2) DEFAULT '0' NOT NULL,
	"credit_revenue" numeric(18, 2) DEFAULT '0' NOT NULL,
	"debit_revenue" numeric(18, 2) DEFAULT '0' NOT NULL,
	"eligible_revenue" numeric(18, 2) DEFAULT '0' NOT NULL,
	"commission_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_by_name" text NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" bigint,
	"approved_by_name" text,
	"approval_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_commission_run_status" CHECK ("sales_commission_run"."status" in ('draft', 'approved')),
	CONSTRAINT "ck_sales_commission_run_dates" CHECK ("sales_commission_run"."period_end" >= "sales_commission_run"."period_start"),
	CONSTRAINT "ck_sales_commission_run_amounts" CHECK ("sales_commission_run"."gross_invoice_revenue" >= 0 and "sales_commission_run"."credit_revenue" >= 0
      and "sales_commission_run"."debit_revenue" >= 0 and "sales_commission_run"."source_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_commission_source" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_commission_source_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"run_id" bigint NOT NULL,
	"line_id" bigint NOT NULL,
	"plan_id" bigint NOT NULL,
	"salesperson_user_id" bigint NOT NULL,
	"source_type" text NOT NULL,
	"source_id" bigint NOT NULL,
	"source_doc_no" text NOT NULL,
	"source_date" date NOT NULL,
	"recognized_amount" numeric(18, 2) NOT NULL,
	"rate_pct" numeric(6, 3) NOT NULL,
	"commission_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_commission_source_type" CHECK ("sales_commission_source"."source_type" in ('invoice', 'credit_note', 'debit_note')),
	CONSTRAINT "ck_sales_commission_source_rate" CHECK ("sales_commission_source"."rate_pct" > 0 and "sales_commission_source"."rate_pct" <= 100)
);
--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "salesperson_user_id" bigint;--> statement-breakpoint
ALTER TABLE "sales_order" ADD COLUMN "salesperson_user_id" bigint;--> statement-breakpoint
-- Expand/backfill: preserve the commercial owner that existed when legacy
-- documents are upgraded. New commands snapshot it at creation/posting time.
UPDATE "sales_order" AS so
SET "salesperson_user_id" = c."owner_user_id"
FROM "customer" AS c
WHERE c."id" = so."customer_id"
  AND c."master_fn" = so."master_fn"
  AND c."company_fn" = so."company_fn"
  AND so."salesperson_user_id" IS NULL;--> statement-breakpoint
UPDATE "invoice" AS i
SET "salesperson_user_id" = so."salesperson_user_id"
FROM "sales_order" AS so
WHERE so."id" = i."order_id"
  AND so."master_fn" = i."master_fn"
  AND so."company_fn" = i."company_fn"
  AND i."salesperson_user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "sales_commission_line" ADD CONSTRAINT "sales_commission_line_run_id_sales_commission_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."sales_commission_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_commission_line" ADD CONSTRAINT "sales_commission_line_plan_id_sales_commission_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."sales_commission_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_commission_line" ADD CONSTRAINT "sales_commission_line_salesperson_user_id_app_user_user_id_fk" FOREIGN KEY ("salesperson_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_commission_plan" ADD CONSTRAINT "sales_commission_plan_salesperson_user_id_app_user_user_id_fk" FOREIGN KEY ("salesperson_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_commission_run" ADD CONSTRAINT "sales_commission_run_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_commission_run" ADD CONSTRAINT "sales_commission_run_approved_by_user_id_app_user_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_commission_source" ADD CONSTRAINT "sales_commission_source_run_id_sales_commission_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."sales_commission_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_commission_source" ADD CONSTRAINT "sales_commission_source_line_id_sales_commission_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."sales_commission_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_commission_source" ADD CONSTRAINT "sales_commission_source_plan_id_sales_commission_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."sales_commission_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_commission_source" ADD CONSTRAINT "sales_commission_source_salesperson_user_id_app_user_user_id_fk" FOREIGN KEY ("salesperson_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_commission_line_no" ON "sales_commission_line" USING btree ("master_fn","company_fn","run_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_sales_commission_line_person" ON "sales_commission_line" USING btree ("master_fn","company_fn","salesperson_user_id","run_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_commission_plan_code" ON "sales_commission_plan" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE INDEX "idx_sales_commission_plan_person_date" ON "sales_commission_plan" USING btree ("master_fn","company_fn","salesperson_user_id","status","effective_from","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_commission_run_docno" ON "sales_commission_run" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_commission_run_period" ON "sales_commission_run" USING btree ("master_fn","company_fn","currency","period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_sales_commission_run_status" ON "sales_commission_run" USING btree ("master_fn","company_fn","status","period_end","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_commission_source_doc" ON "sales_commission_source" USING btree ("master_fn","company_fn","run_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_sales_commission_source_line" ON "sales_commission_source" USING btree ("master_fn","company_fn","line_id","source_date","id");--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_salesperson_user_id_app_user_user_id_fk" FOREIGN KEY ("salesperson_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_salesperson_user_id_app_user_user_id_fk" FOREIGN KEY ("salesperson_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoice_salesperson_date" ON "invoice" USING btree ("master_fn","company_fn","salesperson_user_id","invoice_date","id");--> statement-breakpoint
CREATE INDEX "idx_so_salesperson_date" ON "sales_order" USING btree ("master_fn","company_fn","salesperson_user_id","order_date","id");
