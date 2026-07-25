CREATE TABLE "document_extraction" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_extraction_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"version_id" bigint NOT NULL,
	"extraction_version" integer DEFAULT 1 NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"raw_text" text,
	"output_sha256" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_extraction_version" CHECK ("document_extraction"."extraction_version" > 0),
	CONSTRAINT "ck_document_extraction_provider" CHECK ("document_extraction"."provider" in ('local_ocr','byok_vision')),
	CONSTRAINT "ck_document_extraction_status" CHECK ("document_extraction"."status" in ('queued','extracting','succeeded','failed','unavailable')),
	CONSTRAINT "ck_document_extraction_attempts" CHECK ("document_extraction"."attempts" >= 0),
	CONSTRAINT "ck_document_extraction_output_hash" CHECK ("document_extraction"."output_sha256" is null or (
      char_length("document_extraction"."output_sha256") = 64
      and "document_extraction"."output_sha256" ~ '^[0-9a-f]{64}$'
    ))
);
--> statement-breakpoint
CREATE TABLE "document_processing_policy" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_processing_policy_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"extraction_provider" text DEFAULT 'local_ocr' NOT NULL,
	"vision_provider" text,
	"vision_region" text,
	"vision_retention_days" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_processing_policy_provider" CHECK ("document_processing_policy"."extraction_provider" in ('local_ocr', 'byok_vision')),
	CONSTRAINT "ck_document_processing_policy_vision_provider" CHECK ("document_processing_policy"."vision_provider" is null or "document_processing_policy"."vision_provider" in ('openai', 'google')),
	CONSTRAINT "ck_document_processing_policy_vision_config" CHECK (("document_processing_policy"."extraction_provider" = 'local_ocr'
      and "document_processing_policy"."vision_provider" is null
      and "document_processing_policy"."vision_region" is null
      and "document_processing_policy"."vision_retention_days" is null)
      or ("document_processing_policy"."extraction_provider" = 'byok_vision'
        and char_length("document_processing_policy"."vision_provider") > 0
        and char_length("document_processing_policy"."vision_region") between 2 and 80
        and "document_processing_policy"."vision_retention_days" between 0 and 365)),
	CONSTRAINT "ck_document_processing_policy_version" CHECK ("document_processing_policy"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "document_scan_job" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_scan_job_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"version_id" bigint NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"scanner" text,
	"result_code" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_scan_job_status" CHECK ("document_scan_job"."status" in ('queued','scanning','clean','infected','indeterminate','unavailable')),
	CONSTRAINT "ck_document_scan_job_attempts" CHECK ("document_scan_job"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "document_extraction" ADD CONSTRAINT "document_extraction_version_id_document_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_policy" ADD CONSTRAINT "document_processing_policy_updated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_scan_job" ADD CONSTRAINT "document_scan_job_version_id_document_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_extraction_version" ON "document_extraction" USING btree ("master_fn","company_fn","version_id","extraction_version");--> statement-breakpoint
CREATE INDEX "idx_document_extraction_queue" ON "document_extraction" USING btree ("status","available_at","locked_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_processing_policy_company" ON "document_processing_policy" USING btree ("master_fn","company_fn");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_scan_job_version" ON "document_scan_job" USING btree ("master_fn","company_fn","version_id");--> statement-breakpoint
CREATE INDEX "idx_document_scan_job_queue" ON "document_scan_job" USING btree ("status","available_at","locked_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_outbox_document_signal" ON "outbox_event" USING btree ("master_fn","company_fn","topic","aggregate_type","aggregate_id") WHERE "outbox_event"."topic" in ('document.scan.requested','document.extraction.requested');--> statement-breakpoint
INSERT INTO "integration_connector" (
  "master_fn", "company_fn", "connector_key", "display_name", "category",
  "direction", "schedule", "status", "health", "credential_required", "enabled"
)
SELECT
  "master_fn", "company_fn", 'document-vision', 'Document Vision (BYOK)',
  'Document processing', 'outbound', 'realtime', 'setup', 'unknown', true, false
FROM "company"
ON CONFLICT ("master_fn", "company_fn", "connector_key") DO NOTHING;--> statement-breakpoint
INSERT INTO "document_scan_job" ("master_fn", "company_fn", "version_id")
SELECT "master_fn", "company_fn", "id"
FROM "document_version"
ON CONFLICT ("master_fn", "company_fn", "version_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "outbox_event" (
  "master_fn", "company_fn", "topic", "aggregate_type", "aggregate_id", "payload"
)
SELECT
  "master_fn",
  "company_fn",
  'document.scan.requested',
  'document_version',
  "id"::text,
  jsonb_build_object('versionId', "id")
FROM "document_version"
ON CONFLICT DO NOTHING;
