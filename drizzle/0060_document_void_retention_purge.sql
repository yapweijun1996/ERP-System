-- State-dependent Void/correction, custody, legal hold and two-person purge.
CREATE TABLE "document_correction" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_correction_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"document_id" bigint NOT NULL,
	"source_version_id" bigint NOT NULL,
	"correction_version_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_correction_kind" CHECK ("document_correction"."kind" in ('correction','reversal')),
	CONSTRAINT "ck_document_correction_reason" CHECK (char_length("document_correction"."reason") between 3 and 1000),
	CONSTRAINT "ck_document_correction_versions" CHECK ("document_correction"."source_version_id" <> "document_correction"."correction_version_id")
);
--> statement-breakpoint
CREATE TABLE "document_governance_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_governance_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"document_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"reason" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"record_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_governance_event_type" CHECK ("document_governance_event"."event_type" in (
      'submitted','approved','posted','sealed','voided',
      'correction_created','reversal_created',
      'legal_hold_set','legal_hold_released','paper_custody_changed',
      'purge_requested','purge_approved','purge_rejected'
    )),
	CONSTRAINT "ck_document_governance_event_status" CHECK (("document_governance_event"."from_status" is null or "document_governance_event"."from_status" in (
      'draft','submitted','approved','posted','sealed','voided','corrected'
    )) and ("document_governance_event"."to_status" is null or "document_governance_event"."to_status" in (
      'draft','submitted','approved','posted','sealed','voided','corrected'
    ))),
	CONSTRAINT "ck_document_governance_event_reason" CHECK (char_length("document_governance_event"."reason") between 3 and 1000),
	CONSTRAINT "ck_document_governance_event_version" CHECK ("document_governance_event"."record_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "document_purge_request" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_purge_request_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"document_id" bigint NOT NULL,
	"document_key_hash" text NOT NULL,
	"final_sha256" text NOT NULL,
	"retention_until" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending_finance' NOT NULL,
	"initiated_by_user_id" bigint NOT NULL,
	"initiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_user_id" bigint,
	"review_reason" text,
	"reviewed_at" timestamp with time zone,
	"executed_by_user_id" bigint,
	"executed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_purge_request_hashes" CHECK (char_length("document_purge_request"."document_key_hash") = 64
      and "document_purge_request"."document_key_hash" ~ '^[0-9a-f]{64}$'
      and char_length("document_purge_request"."final_sha256") = 64
      and "document_purge_request"."final_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_document_purge_request_status" CHECK ("document_purge_request"."status" in ('pending_finance','approved','rejected','executed')),
	CONSTRAINT "ck_document_purge_request_review" CHECK (("document_purge_request"."status" = 'pending_finance'
      and "document_purge_request"."reviewed_by_user_id" is null
      and "document_purge_request"."review_reason" is null
      and "document_purge_request"."reviewed_at" is null)
      or ("document_purge_request"."status" in ('approved','rejected','executed')
        and "document_purge_request"."reviewed_by_user_id" is not null
        and "document_purge_request"."reviewed_by_user_id" <> "document_purge_request"."initiated_by_user_id"
        and char_length("document_purge_request"."review_reason") between 3 and 1000
        and "document_purge_request"."reviewed_at" is not null)),
	CONSTRAINT "ck_document_purge_request_execution" CHECK (("document_purge_request"."status" = 'executed'
      and "document_purge_request"."executed_by_user_id" is not null
      and "document_purge_request"."executed_at" is not null)
      or ("document_purge_request"."status" <> 'executed'
        and "document_purge_request"."executed_by_user_id" is null
        and "document_purge_request"."executed_at" is null)),
	CONSTRAINT "ck_document_purge_request_version" CHECK ("document_purge_request"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "document_tombstone" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_tombstone_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"purge_request_id" bigint NOT NULL,
	"original_document_id" bigint NOT NULL,
	"document_key_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"owner_hash" text NOT NULL,
	"final_sha256" text NOT NULL,
	"version_manifest" jsonb NOT NULL,
	"retention_until" timestamp with time zone NOT NULL,
	"final_paper_custody_status" text NOT NULL,
	"initiated_by_user_id" bigint NOT NULL,
	"reviewed_by_user_id" bigint NOT NULL,
	"executed_by_user_id" bigint NOT NULL,
	"purged_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_tombstone_hashes" CHECK (char_length("document_tombstone"."document_key_hash") = 64
      and "document_tombstone"."document_key_hash" ~ '^[0-9a-f]{64}$'
      and char_length("document_tombstone"."owner_hash") = 64
      and "document_tombstone"."owner_hash" ~ '^[0-9a-f]{64}$'
      and char_length("document_tombstone"."final_sha256") = 64
      and "document_tombstone"."final_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_document_tombstone_purpose" CHECK ("document_tombstone"."purpose" in ('receipt','leave_evidence','tax_evidence','other')),
	CONSTRAINT "ck_document_tombstone_paper" CHECK ("document_tombstone"."final_paper_custody_status" in (
      'none','employee','finance_archive','returned','destroyed'
    )),
	CONSTRAINT "ck_document_tombstone_two_person" CHECK ("document_tombstone"."initiated_by_user_id" <> "document_tombstone"."reviewed_by_user_id")
);
--> statement-breakpoint
ALTER TABLE "managed_document" ADD COLUMN "record_status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "managed_document" ADD COLUMN "record_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "managed_document" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "managed_document" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "managed_document" ADD COLUMN "voided_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "managed_document" ADD COLUMN "tax_finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "managed_document" ADD COLUMN "paper_custody_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "managed_document" ADD COLUMN "paper_original_reference" text;--> statement-breakpoint
UPDATE "managed_document" d
SET "record_status" = 'submitted',
    "record_version" = 2,
    "updated_at" = now()
FROM "document_version" v
JOIN "receipt_inbox_item" i
  ON i."master_fn" = v."master_fn"
 AND i."company_fn" = v."company_fn"
 AND i."version_id" = v."id"
WHERE v."master_fn" = d."master_fn"
  AND v."company_fn" = d."company_fn"
  AND v."document_id" = d."id"
  AND v."version_no" = d."current_version_no"
  AND i."status" = 'submitted';--> statement-breakpoint
INSERT INTO "document_governance_event"
  ("master_fn","company_fn","document_id","event_type","from_status","to_status",
   "reason","actor_user_id","record_version")
SELECT d."master_fn",d."company_fn",d."id",'submitted','draft','submitted',
       'Backfilled from governed receipt system submission.',
       i."authorized_by_user_id",d."record_version"
FROM "managed_document" d
JOIN "document_version" v
  ON v."master_fn" = d."master_fn"
 AND v."company_fn" = d."company_fn"
 AND v."document_id" = d."id"
 AND v."version_no" = d."current_version_no"
JOIN "receipt_inbox_item" i
  ON i."master_fn" = v."master_fn"
 AND i."company_fn" = v."company_fn"
 AND i."version_id" = v."id"
WHERE d."record_status" = 'submitted'
  AND i."status" = 'submitted'
  AND i."authorized_by_user_id" IS NOT NULL;--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_managed_document_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND current_setting('app.document_governance_delete', true) = 'on'
    AND OLD.master_fn = current_setting('app.master_fn', true)
    AND OLD.company_fn = current_setting('app.company_fn', true)
  THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'managed document identity is immutable';
  END IF;
  IF OLD.master_fn IS DISTINCT FROM NEW.master_fn
    OR OLD.company_fn IS DISTINCT FROM NEW.company_fn
    OR OLD.document_key IS DISTINCT FROM NEW.document_key
    OR OLD.purpose IS DISTINCT FROM NEW.purpose
    OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id
    OR OLD.original_file_name IS DISTINCT FROM NEW.original_file_name
    OR OLD.created_by_user_id IS DISTINCT FROM NEW.created_by_user_id
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'managed document identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_document_fact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND current_setting('app.document_governance_delete', true) = 'on'
    AND OLD.master_fn = current_setting('app.master_fn', true)
    AND OLD.company_fn = current_setting('app.company_fn', true)
  THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'document version and storage facts are append-only';
END;
$$;--> statement-breakpoint
ALTER TABLE "document_correction" ADD CONSTRAINT "document_correction_document_id_managed_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."managed_document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_correction" ADD CONSTRAINT "document_correction_source_version_id_document_version_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_correction" ADD CONSTRAINT "document_correction_correction_version_id_document_version_id_fk" FOREIGN KEY ("correction_version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_correction" ADD CONSTRAINT "document_correction_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_governance_event" ADD CONSTRAINT "document_governance_event_document_id_managed_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."managed_document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_governance_event" ADD CONSTRAINT "document_governance_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_purge_request" ADD CONSTRAINT "document_purge_request_initiated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_purge_request" ADD CONSTRAINT "document_purge_request_reviewed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_purge_request" ADD CONSTRAINT "document_purge_request_executed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("executed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tombstone" ADD CONSTRAINT "document_tombstone_purge_request_id_document_purge_request_id_fk" FOREIGN KEY ("purge_request_id") REFERENCES "public"."document_purge_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tombstone" ADD CONSTRAINT "document_tombstone_initiated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tombstone" ADD CONSTRAINT "document_tombstone_reviewed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tombstone" ADD CONSTRAINT "document_tombstone_executed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("executed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_correction_version" ON "document_correction" USING btree ("master_fn","company_fn","correction_version_id");--> statement-breakpoint
CREATE INDEX "idx_document_correction_source" ON "document_correction" USING btree ("master_fn","company_fn","source_version_id","id");--> statement-breakpoint
CREATE INDEX "idx_document_governance_event_document" ON "document_governance_event" USING btree ("master_fn","company_fn","document_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_purge_request_document" ON "document_purge_request" USING btree ("master_fn","company_fn","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_purge_request_key_hash" ON "document_purge_request" USING btree ("master_fn","company_fn","document_key_hash");--> statement-breakpoint
CREATE INDEX "idx_document_purge_request_status" ON "document_purge_request" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_tombstone_request" ON "document_tombstone" USING btree ("purge_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_tombstone_key_hash" ON "document_tombstone" USING btree ("master_fn","company_fn","document_key_hash");--> statement-breakpoint
ALTER TABLE "managed_document" ADD CONSTRAINT "managed_document_voided_by_user_id_app_user_user_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_document" ADD CONSTRAINT "ck_managed_document_record_status" CHECK ("managed_document"."record_status" in (
      'draft','submitted','approved','posted','sealed','voided','corrected'
    ));--> statement-breakpoint
ALTER TABLE "managed_document" ADD CONSTRAINT "ck_managed_document_record_version" CHECK ("managed_document"."record_version" > 0);--> statement-breakpoint
ALTER TABLE "managed_document" ADD CONSTRAINT "ck_managed_document_void" CHECK (("managed_document"."record_status" = 'voided'
      and char_length("managed_document"."void_reason") between 3 and 1000
      and "managed_document"."voided_at" is not null
      and "managed_document"."voided_by_user_id" is not null)
      or ("managed_document"."record_status" <> 'voided'
        and "managed_document"."void_reason" is null
        and "managed_document"."voided_at" is null
        and "managed_document"."voided_by_user_id" is null));--> statement-breakpoint
ALTER TABLE "managed_document" ADD CONSTRAINT "ck_managed_document_tax_finalized" CHECK ("managed_document"."tax_finalized_at" is null
      or "managed_document"."record_status" in ('sealed','corrected'));--> statement-breakpoint
ALTER TABLE "managed_document" ADD CONSTRAINT "ck_managed_document_paper_custody" CHECK (("managed_document"."paper_custody_status" = 'none' and "managed_document"."paper_original_reference" is null)
      or ("managed_document"."paper_custody_status" in (
          'employee','finance_archive','returned','destroyed'
        )
        and char_length("managed_document"."paper_original_reference") between 1 and 160));
