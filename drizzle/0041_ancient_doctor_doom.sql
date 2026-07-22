CREATE TABLE "import_job" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_job_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"target" text NOT NULL,
	"file_name" text NOT NULL,
	"duplicate_strategy" text NOT NULL,
	"status" text DEFAULT 'validated' NOT NULL,
	"total_rows" integer NOT NULL,
	"ready_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"skipped_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_import_job_target" CHECK ("import_job"."target" in ('customer')),
	CONSTRAINT "ck_import_job_duplicate_strategy" CHECK ("import_job"."duplicate_strategy" in ('update_existing', 'skip_existing')),
	CONSTRAINT "ck_import_job_status" CHECK ("import_job"."status" in ('validated', 'invalid', 'processing', 'completed', 'failed')),
	CONSTRAINT "ck_import_job_counts" CHECK ("import_job"."total_rows" >= 0 and "import_job"."ready_rows" >= 0 and "import_job"."error_rows" >= 0 and "import_job"."skipped_rows" >= 0 and "import_job"."imported_rows" >= 0)
);
--> statement-breakpoint
CREATE TABLE "import_job_row" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_job_row_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"job_id" bigint NOT NULL,
	"row_number" integer NOT NULL,
	"code" text,
	"name" text,
	"industry" text,
	"operation" text NOT NULL,
	"status" text NOT NULL,
	"imported_customer_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_import_job_row_number" CHECK ("import_job_row"."row_number" > 0),
	CONSTRAINT "ck_import_job_row_operation" CHECK ("import_job_row"."operation" in ('create', 'update', 'skip', 'invalid')),
	CONSTRAINT "ck_import_job_row_status" CHECK ("import_job_row"."status" in ('ready', 'error', 'skipped', 'imported'))
);
--> statement-breakpoint
CREATE TABLE "import_row_error" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_row_error_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"job_id" bigint NOT NULL,
	"row_number" integer NOT NULL,
	"field" text NOT NULL,
	"error_code" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_import_row_error_number" CHECK ("import_row_error"."row_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job_row" ADD CONSTRAINT "import_job_row_job_id_import_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job_row" ADD CONSTRAINT "import_job_row_imported_customer_id_customer_id_fk" FOREIGN KEY ("imported_customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row_error" ADD CONSTRAINT "import_row_error_job_id_import_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_import_job_tenant_status" ON "import_job" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_import_job_row_number" ON "import_job_row" USING btree ("master_fn","company_fn","job_id","row_number");--> statement-breakpoint
CREATE INDEX "idx_import_job_row_job" ON "import_job_row" USING btree ("master_fn","company_fn","job_id","id");--> statement-breakpoint
CREATE INDEX "idx_import_row_error_job" ON "import_row_error" USING btree ("master_fn","company_fn","job_id","row_number","id");