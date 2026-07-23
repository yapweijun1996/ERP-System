CREATE TABLE "budget_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "budget_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"budget_version_id" bigint NOT NULL,
	"account_id" bigint NOT NULL,
	"period_no" integer NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_budget_line_period" CHECK ("budget_line"."period_no" between 1 and 53),
	CONSTRAINT "ck_budget_line_amount" CHECK ("budget_line"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "budget_version" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "budget_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"approved_by_user_id" bigint,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_budget_version_status" CHECK ("budget_version"."status" in ('draft','approved','archived')),
	CONSTRAINT "ck_budget_version_currency" CHECK (char_length("budget_version"."currency") = 3),
	CONSTRAINT "ck_budget_version_active_status" CHECK (not "budget_version"."is_active" or "budget_version"."status" = 'approved')
);
--> statement-breakpoint
CREATE TABLE "consolidation_rate" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consolidation_rate_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period_no" integer NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"average_rate" numeric(18, 8) NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"approved_by_user_id" bigint,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_consolidation_rate_period" CHECK ("consolidation_rate"."period_no" between 1 and 53),
	CONSTRAINT "ck_consolidation_rate_positive" CHECK ("consolidation_rate"."average_rate" > 0),
	CONSTRAINT "ck_consolidation_rate_currency" CHECK (
    char_length("consolidation_rate"."from_currency") = 3
    and char_length("consolidation_rate"."to_currency") = 3
    and "consolidation_rate"."from_currency" <> "consolidation_rate"."to_currency"
  ),
	CONSTRAINT "ck_consolidation_rate_status" CHECK ("consolidation_rate"."status" in ('draft','approved','archived'))
);
--> statement-breakpoint
CREATE TABLE "financial_statement_account_map" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "financial_statement_account_map_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"account_id" bigint NOT NULL,
	"section" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"sign_policy" text DEFAULT 'positive' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_financial_statement_section" CHECK ("financial_statement_account_map"."section" in (
    'revenue','cost_of_sales','operating_expense','other_income','other_expense','tax'
  )),
	CONSTRAINT "ck_financial_statement_sign" CHECK ("financial_statement_account_map"."sign_policy" in ('positive','negative'))
);
--> statement-breakpoint
CREATE TABLE "report_artifact" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "report_artifact_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"job_id" bigint NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_report_artifact_size" CHECK ("report_artifact"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "report_job" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "report_job_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"report_key" text NOT NULL,
	"format" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"presentation_currency" text NOT NULL,
	"filters" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_report_job_key" CHECK ("report_job"."report_key" in ('profit_loss')),
	CONSTRAINT "ck_report_job_format" CHECK ("report_job"."format" in ('xlsx','pdf')),
	CONSTRAINT "ck_report_job_status" CHECK ("report_job"."status" in (
    'queued','running','succeeded','failed','expired'
  )),
	CONSTRAINT "ck_report_job_attempts" CHECK ("report_job"."attempts" >= 0 and "report_job"."attempts" <= 3),
	CONSTRAINT "ck_report_job_currency" CHECK (char_length("report_job"."presentation_currency") = 3)
);
--> statement-breakpoint
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_budget_version_id_budget_version_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_version" ADD CONSTRAINT "budget_version_approved_by_user_id_app_user_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consolidation_rate" ADD CONSTRAINT "consolidation_rate_approved_by_user_id_app_user_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement_account_map" ADD CONSTRAINT "financial_statement_account_map_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_artifact" ADD CONSTRAINT "report_artifact_job_id_report_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."report_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_job" ADD CONSTRAINT "report_job_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_budget_line_period_account" ON "budget_line" USING btree ("master_fn","company_fn","budget_version_id","account_id","period_no");--> statement-breakpoint
CREATE INDEX "idx_budget_line_version" ON "budget_line" USING btree ("master_fn","company_fn","budget_version_id","period_no","account_id");--> statement-breakpoint
CREATE INDEX "idx_budget_version_company" ON "budget_version" USING btree ("master_fn","company_fn","fiscal_year","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_budget_version_name" ON "budget_version" USING btree ("master_fn","company_fn","fiscal_year","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_budget_version_active" ON "budget_version" USING btree ("master_fn","company_fn","fiscal_year") WHERE "budget_version"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_consolidation_rate_period" ON "consolidation_rate" USING btree ("master_fn","company_fn","fiscal_year","period_no","from_currency","to_currency");--> statement-breakpoint
CREATE INDEX "idx_consolidation_rate_lookup" ON "consolidation_rate" USING btree ("master_fn","company_fn","status","fiscal_year","period_no","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_financial_statement_account_map" ON "financial_statement_account_map" USING btree ("master_fn","company_fn","account_id");--> statement-breakpoint
CREATE INDEX "idx_financial_statement_map_section" ON "financial_statement_account_map" USING btree ("master_fn","company_fn","section","display_order","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_report_artifact_job" ON "report_artifact" USING btree ("master_fn","company_fn","job_id");--> statement-breakpoint
CREATE INDEX "idx_report_artifact_expiry" ON "report_artifact" USING btree ("expires_at","id");--> statement-breakpoint
CREATE INDEX "idx_report_job_queue" ON "report_job" USING btree ("status","available_at","id");--> statement-breakpoint
CREATE INDEX "idx_report_job_actor" ON "report_job" USING btree ("master_fn","company_fn","actor_user_id","created_at","id");--> statement-breakpoint
INSERT INTO "financial_statement_account_map" (
  "master_fn",
  "company_fn",
  "account_id",
  "section",
  "display_order",
  "sign_policy"
)
SELECT
  "master_fn",
  "company_fn",
  "id",
  CASE
    WHEN "type" = 'income' THEN 'revenue'
    WHEN "type" = 'expense' AND "code" LIKE '5%' THEN 'cost_of_sales'
    WHEN "type" = 'expense' THEN 'operating_expense'
  END,
  ROW_NUMBER() OVER (
    PARTITION BY "master_fn", "company_fn", "type"
    ORDER BY "code", "id"
  )::integer,
  CASE WHEN "type" = 'income' THEN 'positive' ELSE 'negative' END
FROM "account"
WHERE "type" IN ('income', 'expense')
ON CONFLICT ("master_fn", "company_fn", "account_id") DO NOTHING;
