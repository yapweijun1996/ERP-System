CREATE TABLE "asset" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"asset_no" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"location" text,
	"acquisition_date" date NOT NULL,
	"cost" numeric(18, 2) NOT NULL,
	"residual_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"useful_life_years" integer NOT NULL,
	"method" text DEFAULT 'straight_line' NOT NULL,
	"accumulated_depreciation" numeric(18, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'in_use' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_asset_category" CHECK ("asset"."category" in ('Plant & Machinery', 'Vehicles', 'Lab Equipment', 'Furniture & Fixtures', 'IT Equipment', 'Warehouse Equipment')),
	CONSTRAINT "ck_asset_status" CHECK ("asset"."status" in ('in_use', 'under_maintenance', 'idle', 'disposed')),
	CONSTRAINT "ck_asset_method" CHECK ("asset"."method" = 'straight_line'),
	CONSTRAINT "ck_asset_amounts" CHECK ("asset"."cost" >= 0 and "asset"."residual_value" >= 0 and "asset"."residual_value" <= "asset"."cost" and "asset"."useful_life_years" > 0)
);
--> statement-breakpoint
CREATE TABLE "depreciation_run" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "depreciation_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"run_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_depreciation_run_status" CHECK ("depreciation_run"."status" in ('draft', 'posted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "depreciation_run_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "depreciation_run_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"run_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"asset_id" bigint NOT NULL,
	"opening_nbv" numeric(18, 2) NOT NULL,
	"depreciation_amount" numeric(18, 2) NOT NULL,
	"closing_nbv" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_depreciation_run_line_amounts" CHECK ("depreciation_run_line"."depreciation_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "depreciation_run_line" ADD CONSTRAINT "depreciation_run_line_run_id_depreciation_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."depreciation_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_run_line" ADD CONSTRAINT "depreciation_run_line_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_asset_no" ON "asset" USING btree ("master_fn","company_fn","asset_no");--> statement-breakpoint
CREATE INDEX "idx_asset_status" ON "asset" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_depreciation_run_docno" ON "depreciation_run" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_depreciation_run_date" ON "depreciation_run" USING btree ("master_fn","company_fn","run_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_depreciation_run_line" ON "depreciation_run_line" USING btree ("master_fn","company_fn","run_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_depreciation_run_line_asset" ON "depreciation_run_line" USING btree ("master_fn","company_fn","asset_id","run_id");