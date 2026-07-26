CREATE TABLE "tax_evidence_access_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_evidence_access_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"artifact_id" bigint NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"access_key" text NOT NULL,
	"action" text NOT NULL,
	"purpose" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_tax_evidence_access_key" CHECK ("tax_evidence_access_event"."access_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_tax_evidence_access_action" CHECK ("tax_evidence_access_event"."action" in ('view','download','print','export')),
	CONSTRAINT "ck_tax_evidence_access_purpose" CHECK (char_length("tax_evidence_access_event"."purpose") between 3 and 500),
	CONSTRAINT "ck_tax_evidence_access_hash" CHECK (char_length("tax_evidence_access_event"."artifact_sha256") = 64
      and "tax_evidence_access_event"."artifact_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "tax_evidence_artifact" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_evidence_artifact_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"job_id" bigint NOT NULL,
	"snapshot_id" bigint NOT NULL,
	"artifact_type" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_tax_evidence_artifact_type" CHECK ("tax_evidence_artifact"."artifact_type" in (
      'register_pdf','merged_pdf','register_xlsx','register_csv',
      'originals_zip','manifest_json'
    )),
	CONSTRAINT "ck_tax_evidence_artifact_file" CHECK (char_length("tax_evidence_artifact"."file_name") between 5 and 255
      and char_length("tax_evidence_artifact"."mime_type") between 3 and 160),
	CONSTRAINT "ck_tax_evidence_artifact_hash" CHECK (char_length("tax_evidence_artifact"."sha256") = 64 and "tax_evidence_artifact"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_tax_evidence_artifact_size" CHECK ("tax_evidence_artifact"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "tax_evidence_report_job" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_evidence_report_job_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"job_key" text NOT NULL,
	"snapshot_id" bigint NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"completed_at" timestamp with time zone,
	"artifact_set_sha256" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_tax_evidence_report_job_key" CHECK ("tax_evidence_report_job"."job_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_tax_evidence_report_job_locale" CHECK ("tax_evidence_report_job"."locale" in ('en','ms','zh','ja','vi')),
	CONSTRAINT "ck_tax_evidence_report_job_status" CHECK ("tax_evidence_report_job"."status" in ('queued','running','succeeded','failed')),
	CONSTRAINT "ck_tax_evidence_report_job_attempts" CHECK ("tax_evidence_report_job"."attempts" >= 0 and "tax_evidence_report_job"."attempts" <= 3),
	CONSTRAINT "ck_tax_evidence_report_job_artifact_hash" CHECK ("tax_evidence_report_job"."artifact_set_sha256" is null
      or (char_length("tax_evidence_report_job"."artifact_set_sha256") = 64
        and "tax_evidence_report_job"."artifact_set_sha256" ~ '^[0-9a-f]{64}$'))
);
--> statement-breakpoint
CREATE TABLE "tax_evidence_snapshot" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_evidence_snapshot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"snapshot_key" text NOT NULL,
	"filters" jsonb NOT NULL,
	"source_sha256" text NOT NULL,
	"row_count" integer NOT NULL,
	"document_count" integer NOT NULL,
	"original_gross" numeric(18, 2) NOT NULL,
	"base_expense" numeric(18, 2) NOT NULL,
	"base_input_tax" numeric(18, 2) NOT NULL,
	"base_gross" numeric(18, 2) NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_tax_evidence_snapshot_key" CHECK ("tax_evidence_snapshot"."snapshot_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_tax_evidence_snapshot_hash" CHECK (char_length("tax_evidence_snapshot"."source_sha256") = 64
      and "tax_evidence_snapshot"."source_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_tax_evidence_snapshot_counts" CHECK ("tax_evidence_snapshot"."row_count" > 0 and "tax_evidence_snapshot"."document_count" >= 0),
	CONSTRAINT "ck_tax_evidence_snapshot_totals" CHECK ("tax_evidence_snapshot"."original_gross" > 0
      and "tax_evidence_snapshot"."base_expense" >= 0
      and "tax_evidence_snapshot"."base_input_tax" >= 0
      and "tax_evidence_snapshot"."base_gross" = "tax_evidence_snapshot"."base_expense" + "tax_evidence_snapshot"."base_input_tax"
      and "tax_evidence_snapshot"."base_gross" > 0)
);
--> statement-breakpoint
CREATE TABLE "tax_evidence_snapshot_document" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_evidence_snapshot_document_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"snapshot_id" bigint NOT NULL,
	"document_version_id" bigint NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"source_posting_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_tax_evidence_snapshot_document_file" CHECK (char_length("tax_evidence_snapshot_document"."file_name") between 1 and 255
      and char_length("tax_evidence_snapshot_document"."mime_type") between 3 and 160),
	CONSTRAINT "ck_tax_evidence_snapshot_document_hash" CHECK (char_length("tax_evidence_snapshot_document"."sha256") = 64 and "tax_evidence_snapshot_document"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_tax_evidence_snapshot_document_size" CHECK ("tax_evidence_snapshot_document"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "tax_evidence_snapshot_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_evidence_snapshot_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"snapshot_id" bigint NOT NULL,
	"ordinal" integer NOT NULL,
	"posting_id" bigint NOT NULL,
	"facts" jsonb NOT NULL,
	"facts_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_tax_evidence_snapshot_line_ordinal" CHECK ("tax_evidence_snapshot_line"."ordinal" > 0),
	CONSTRAINT "ck_tax_evidence_snapshot_line_hash" CHECK (char_length("tax_evidence_snapshot_line"."facts_sha256") = 64
      and "tax_evidence_snapshot_line"."facts_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "tax_evidence_access_event" ADD CONSTRAINT "tax_evidence_access_event_artifact_id_tax_evidence_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."tax_evidence_artifact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_access_event" ADD CONSTRAINT "tax_evidence_access_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_artifact" ADD CONSTRAINT "tax_evidence_artifact_job_id_tax_evidence_report_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."tax_evidence_report_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_artifact" ADD CONSTRAINT "tax_evidence_artifact_snapshot_id_tax_evidence_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."tax_evidence_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_report_job" ADD CONSTRAINT "tax_evidence_report_job_snapshot_id_tax_evidence_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."tax_evidence_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_report_job" ADD CONSTRAINT "tax_evidence_report_job_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_snapshot" ADD CONSTRAINT "tax_evidence_snapshot_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_snapshot_document" ADD CONSTRAINT "tax_evidence_snapshot_document_snapshot_id_tax_evidence_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."tax_evidence_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_snapshot_document" ADD CONSTRAINT "tax_evidence_snapshot_document_document_version_id_document_version_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_snapshot_line" ADD CONSTRAINT "tax_evidence_snapshot_line_snapshot_id_tax_evidence_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."tax_evidence_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_snapshot_line" ADD CONSTRAINT "tax_evidence_snapshot_line_posting_id_expense_posting_id_fk" FOREIGN KEY ("posting_id") REFERENCES "public"."expense_posting"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_access_key" ON "tax_evidence_access_event" USING btree ("master_fn","company_fn","artifact_id","actor_user_id","access_key");--> statement-breakpoint
CREATE INDEX "idx_tax_evidence_access_artifact" ON "tax_evidence_access_event" USING btree ("master_fn","company_fn","artifact_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_artifact_type" ON "tax_evidence_artifact" USING btree ("master_fn","company_fn","job_id","artifact_type");--> statement-breakpoint
CREATE INDEX "idx_tax_evidence_artifact_snapshot" ON "tax_evidence_artifact" USING btree ("master_fn","company_fn","snapshot_id","artifact_type","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_report_job_key" ON "tax_evidence_report_job" USING btree ("master_fn","company_fn","job_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_report_job_snapshot" ON "tax_evidence_report_job" USING btree ("master_fn","company_fn","snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_tax_evidence_report_job_queue" ON "tax_evidence_report_job" USING btree ("status","available_at","id");--> statement-breakpoint
CREATE INDEX "idx_tax_evidence_report_job_actor" ON "tax_evidence_report_job" USING btree ("master_fn","company_fn","actor_user_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_snapshot_key" ON "tax_evidence_snapshot" USING btree ("master_fn","company_fn","snapshot_key");--> statement-breakpoint
CREATE INDEX "idx_tax_evidence_snapshot_actor" ON "tax_evidence_snapshot" USING btree ("master_fn","company_fn","created_by_user_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_snapshot_document" ON "tax_evidence_snapshot_document" USING btree ("master_fn","company_fn","snapshot_id","document_version_id");--> statement-breakpoint
CREATE INDEX "idx_tax_evidence_snapshot_document_snapshot" ON "tax_evidence_snapshot_document" USING btree ("master_fn","company_fn","snapshot_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_snapshot_line_ordinal" ON "tax_evidence_snapshot_line" USING btree ("master_fn","company_fn","snapshot_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_snapshot_line_posting" ON "tax_evidence_snapshot_line" USING btree ("master_fn","company_fn","snapshot_id","posting_id");--> statement-breakpoint
CREATE INDEX "idx_tax_evidence_snapshot_line" ON "tax_evidence_snapshot_line" USING btree ("master_fn","company_fn","snapshot_id","id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_tax_evidence_fact_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_tax_evidence_snapshot_immutable ON tax_evidence_snapshot;
--> statement-breakpoint
CREATE TRIGGER trg_tax_evidence_snapshot_immutable
BEFORE UPDATE OR DELETE ON tax_evidence_snapshot
FOR EACH ROW EXECUTE FUNCTION prevent_tax_evidence_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_tax_evidence_snapshot_line_immutable ON tax_evidence_snapshot_line;
--> statement-breakpoint
CREATE TRIGGER trg_tax_evidence_snapshot_line_immutable
BEFORE UPDATE OR DELETE ON tax_evidence_snapshot_line
FOR EACH ROW EXECUTE FUNCTION prevent_tax_evidence_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_tax_evidence_snapshot_document_immutable ON tax_evidence_snapshot_document;
--> statement-breakpoint
CREATE TRIGGER trg_tax_evidence_snapshot_document_immutable
BEFORE UPDATE OR DELETE ON tax_evidence_snapshot_document
FOR EACH ROW EXECUTE FUNCTION prevent_tax_evidence_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_tax_evidence_artifact_immutable ON tax_evidence_artifact;
--> statement-breakpoint
CREATE TRIGGER trg_tax_evidence_artifact_immutable
BEFORE UPDATE OR DELETE ON tax_evidence_artifact
FOR EACH ROW EXECUTE FUNCTION prevent_tax_evidence_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_tax_evidence_access_immutable ON tax_evidence_access_event;
--> statement-breakpoint
CREATE TRIGGER trg_tax_evidence_access_immutable
BEFORE UPDATE OR DELETE ON tax_evidence_access_event
FOR EACH ROW EXECUTE FUNCTION prevent_tax_evidence_fact_change();
