-- Confidence-governed receipt inbox and prior uploader authorization.
CREATE TABLE "document_extraction_field" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_extraction_field_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"extraction_id" bigint NOT NULL,
	"field_key" text NOT NULL,
	"candidate_no" integer DEFAULT 1 NOT NULL,
	"value_text" text NOT NULL,
	"normalized_value" text NOT NULL,
	"source_type" text NOT NULL,
	"source_ref" text NOT NULL,
	"model" text NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"critical" boolean DEFAULT false NOT NULL,
	"review_state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_extraction_field_key" CHECK ("document_extraction_field"."field_key" ~ '^[a-z][a-z0-9_]{1,63}$'),
	CONSTRAINT "ck_document_extraction_field_candidate" CHECK ("document_extraction_field"."candidate_no" > 0),
	CONSTRAINT "ck_document_extraction_field_value" CHECK (char_length("document_extraction_field"."value_text") between 1 and 4000),
	CONSTRAINT "ck_document_extraction_field_source" CHECK ("document_extraction_field"."source_type" in ('local_ocr','byok_vision','user')
      and char_length("document_extraction_field"."source_ref") between 1 and 500),
	CONSTRAINT "ck_document_extraction_field_confidence" CHECK ("document_extraction_field"."confidence" between 0.0000 and 1.0000),
	CONSTRAINT "ck_document_extraction_field_review_state" CHECK ("document_extraction_field"."review_state" in ('accepted','low_confidence','conflict'))
);
--> statement-breakpoint
CREATE TABLE "receipt_inbox_item" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "receipt_inbox_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"version_id" bigint NOT NULL,
	"extraction_id" bigint NOT NULL,
	"owner_user_id" bigint NOT NULL,
	"status" text NOT NULL,
	"review_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duplicate_of_version_id" bigint,
	"submission_kind" text DEFAULT 'none' NOT NULL,
	"authorized_by_user_id" bigint,
	"upload_authorized_at" timestamp with time zone,
	"system_actor_key" text,
	"submitted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_receipt_inbox_status" CHECK ("receipt_inbox_item"."status" in ('review_required','ready','submitted')),
	CONSTRAINT "ck_receipt_inbox_submission_kind" CHECK ("receipt_inbox_item"."submission_kind" in ('none','system')),
	CONSTRAINT "ck_receipt_inbox_submission" CHECK (("receipt_inbox_item"."status" = 'submitted'
      and "receipt_inbox_item"."submission_kind" = 'system'
      and "receipt_inbox_item"."authorized_by_user_id" is not null
      and "receipt_inbox_item"."upload_authorized_at" is not null
      and "receipt_inbox_item"."system_actor_key" = 'receipt-auto-submit-v1'
      and "receipt_inbox_item"."submitted_at" is not null)
      or ("receipt_inbox_item"."status" <> 'submitted'
        and "receipt_inbox_item"."submission_kind" = 'none'
        and "receipt_inbox_item"."authorized_by_user_id" is null
        and "receipt_inbox_item"."upload_authorized_at" is null
        and "receipt_inbox_item"."system_actor_key" is null
        and "receipt_inbox_item"."submitted_at" is null)),
	CONSTRAINT "ck_receipt_inbox_version" CHECK ("receipt_inbox_item"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "receipt_upload_authorization" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "receipt_upload_authorization_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"version_id" bigint NOT NULL,
	"uploader_user_id" bigint NOT NULL,
	"auto_submit_authorized" boolean DEFAULT false NOT NULL,
	"authorized_at" timestamp with time zone,
	"statement_version" text DEFAULT 'receipt-auto-submit-v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_receipt_upload_authorization" CHECK (("receipt_upload_authorization"."auto_submit_authorized" and "receipt_upload_authorization"."authorized_at" is not null)
      or (not "receipt_upload_authorization"."auto_submit_authorized" and "receipt_upload_authorization"."authorized_at" is null)),
	CONSTRAINT "ck_receipt_upload_authorization_statement" CHECK ("receipt_upload_authorization"."statement_version" = 'receipt-auto-submit-v1')
);
--> statement-breakpoint
DROP INDEX "uq_outbox_document_signal";--> statement-breakpoint
ALTER TABLE "document_processing_policy" ADD COLUMN "auto_submit_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document_processing_policy" ADD COLUMN "auto_submit_min_confidence" numeric(5, 4) DEFAULT '0.9800' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_extraction_field" ADD CONSTRAINT "document_extraction_field_extraction_id_document_extraction_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."document_extraction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_inbox_item" ADD CONSTRAINT "receipt_inbox_item_version_id_document_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_inbox_item" ADD CONSTRAINT "receipt_inbox_item_extraction_id_document_extraction_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."document_extraction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_inbox_item" ADD CONSTRAINT "receipt_inbox_item_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_inbox_item" ADD CONSTRAINT "receipt_inbox_item_duplicate_of_version_id_document_version_id_fk" FOREIGN KEY ("duplicate_of_version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_inbox_item" ADD CONSTRAINT "receipt_inbox_item_authorized_by_user_id_app_user_user_id_fk" FOREIGN KEY ("authorized_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_upload_authorization" ADD CONSTRAINT "receipt_upload_authorization_version_id_document_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_upload_authorization" ADD CONSTRAINT "receipt_upload_authorization_uploader_user_id_app_user_user_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_extraction_field_candidate" ON "document_extraction_field" USING btree ("master_fn","company_fn","extraction_id","field_key","candidate_no");--> statement-breakpoint
CREATE INDEX "idx_document_extraction_field_review" ON "document_extraction_field" USING btree ("master_fn","company_fn","extraction_id","review_state","field_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_receipt_inbox_version" ON "receipt_inbox_item" USING btree ("master_fn","company_fn","version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_receipt_inbox_extraction" ON "receipt_inbox_item" USING btree ("master_fn","company_fn","extraction_id");--> statement-breakpoint
CREATE INDEX "idx_receipt_inbox_owner_status" ON "receipt_inbox_item" USING btree ("master_fn","company_fn","owner_user_id","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_receipt_upload_authorization_version" ON "receipt_upload_authorization" USING btree ("master_fn","company_fn","version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_outbox_document_signal" ON "outbox_event" USING btree ("master_fn","company_fn","topic","aggregate_type","aggregate_id") WHERE "outbox_event"."topic" in (
    'document.scan.requested',
    'document.extraction.requested',
    'receipt.inbox.submitted'
  );--> statement-breakpoint
ALTER TABLE "document_processing_policy" ADD CONSTRAINT "ck_document_processing_policy_auto_submit_confidence" CHECK ("document_processing_policy"."auto_submit_min_confidence" between 0.9800 and 1.0000);
