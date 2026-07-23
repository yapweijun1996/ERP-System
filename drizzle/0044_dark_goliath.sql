CREATE TABLE "accounting_period" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "accounting_period_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period_no" integer NOT NULL,
	"label" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by_user_id" bigint,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_accounting_period_number" CHECK ("accounting_period"."period_no" between 1 and 53),
	CONSTRAINT "ck_accounting_period_dates" CHECK ("accounting_period"."end_date" >= "accounting_period"."start_date"),
	CONSTRAINT "ck_accounting_period_status" CHECK ("accounting_period"."status" in ('open','locked'))
);
--> statement-breakpoint
CREATE TABLE "company_policy" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "company_policy_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"date_format" text DEFAULT 'YYYY-MM-DD' NOT NULL,
	"negative_stock_policy" text DEFAULT 'block' NOT NULL,
	"approval_threshold" numeric(18, 2) DEFAULT '0' NOT NULL,
	"session_timeout_minutes" integer DEFAULT 30 NOT NULL,
	"default_warehouse_code" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_company_policy_date_format" CHECK ("company_policy"."date_format" in ('YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY')),
	CONSTRAINT "ck_company_policy_negative_stock" CHECK ("company_policy"."negative_stock_policy" in ('block','warn')),
	CONSTRAINT "ck_company_policy_threshold" CHECK ("company_policy"."approval_threshold" >= 0),
	CONSTRAINT "ck_company_policy_timeout" CHECK ("company_policy"."session_timeout_minutes" between 15 and 1440)
);
--> statement-breakpoint
CREATE TABLE "document_sequence" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_sequence_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"document_type" text NOT NULL,
	"prefix" text NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"padding" integer DEFAULT 4 NOT NULL,
	"reset_policy" text DEFAULT 'yearly' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_sequence_next" CHECK ("document_sequence"."next_number" > 0),
	CONSTRAINT "ck_document_sequence_padding" CHECK ("document_sequence"."padding" between 2 and 10),
	CONSTRAINT "ck_document_sequence_reset" CHECK ("document_sequence"."reset_policy" in ('never','yearly','monthly'))
);
--> statement-breakpoint
CREATE TABLE "integration_connector" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "integration_connector_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"connector_key" text NOT NULL,
	"display_name" text NOT NULL,
	"category" text NOT NULL,
	"direction" text NOT NULL,
	"schedule" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'setup' NOT NULL,
	"health" text DEFAULT 'unknown' NOT NULL,
	"endpoint_host" text,
	"credential_required" boolean DEFAULT true NOT NULL,
	"credential_envelope" jsonb,
	"credential_label" text,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error_code" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_integration_connector_direction" CHECK ("integration_connector"."direction" in ('inbound','outbound','two_way')),
	CONSTRAINT "ck_integration_connector_status" CHECK ("integration_connector"."status" in ('setup','connected','paused','error')),
	CONSTRAINT "ck_integration_connector_health" CHECK ("integration_connector"."health" in ('unknown','healthy','warning','error')),
	CONSTRAINT "ck_integration_connector_records" CHECK ("integration_connector"."records_processed" >= 0)
);
--> statement-breakpoint
ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_locked_by_user_id_app_user_user_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounting_period" ON "accounting_period" USING btree ("master_fn","company_fn","fiscal_year","period_no");--> statement-breakpoint
CREATE INDEX "idx_accounting_period_status" ON "accounting_period" USING btree ("master_fn","company_fn","status","start_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_policy_company" ON "company_policy" USING btree ("master_fn","company_fn");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_sequence_type" ON "document_sequence" USING btree ("master_fn","company_fn","document_type");--> statement-breakpoint
CREATE INDEX "idx_document_sequence_company" ON "document_sequence" USING btree ("master_fn","company_fn","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_integration_connector_key" ON "integration_connector" USING btree ("master_fn","company_fn","connector_key");--> statement-breakpoint
CREATE INDEX "idx_integration_connector_status" ON "integration_connector" USING btree ("master_fn","company_fn","status","id");