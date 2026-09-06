CREATE TABLE "company_receipt_pack_governance_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "company_receipt_pack_governance_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"pack_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"from_legal_hold" boolean,
	"to_legal_hold" boolean,
	"reason" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"record_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_company_receipt_pack_governance_event_type" CHECK ("company_receipt_pack_governance_event"."event_type" in ('legal_hold_set','legal_hold_released',
      'purge_requested','purge_approved','purge_rejected')),
	CONSTRAINT "ck_company_receipt_pack_governance_event_hold" CHECK (("company_receipt_pack_governance_event"."event_type" in ('legal_hold_set','legal_hold_released')
      and "company_receipt_pack_governance_event"."from_legal_hold" is not null and "company_receipt_pack_governance_event"."to_legal_hold" is not null)
      or ("company_receipt_pack_governance_event"."event_type" not in ('legal_hold_set','legal_hold_released')
        and "company_receipt_pack_governance_event"."from_legal_hold" is null and "company_receipt_pack_governance_event"."to_legal_hold" is null)),
	CONSTRAINT "ck_company_receipt_pack_governance_event_reason" CHECK (char_length("company_receipt_pack_governance_event"."reason") between 3 and 1000),
	CONSTRAINT "ck_company_receipt_pack_governance_event_version" CHECK ("company_receipt_pack_governance_event"."record_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "company_receipt_pack_purge_request" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "company_receipt_pack_purge_request_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"pack_id" bigint NOT NULL,
	"pack_key_hash" text NOT NULL,
	"source_sha256" text NOT NULL,
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
	CONSTRAINT "ck_company_receipt_pack_purge_request_hashes" CHECK (char_length("company_receipt_pack_purge_request"."pack_key_hash") = 64
      and "company_receipt_pack_purge_request"."pack_key_hash" ~ '^[0-9a-f]{64}$'
      and char_length("company_receipt_pack_purge_request"."source_sha256") = 64
      and "company_receipt_pack_purge_request"."source_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_company_receipt_pack_purge_request_status" CHECK ("company_receipt_pack_purge_request"."status" in ('pending_finance','approved','rejected','executed')),
	CONSTRAINT "ck_company_receipt_pack_purge_request_review" CHECK (("company_receipt_pack_purge_request"."status" = 'pending_finance'
      and "company_receipt_pack_purge_request"."reviewed_by_user_id" is null
      and "company_receipt_pack_purge_request"."review_reason" is null
      and "company_receipt_pack_purge_request"."reviewed_at" is null)
      or ("company_receipt_pack_purge_request"."status" in ('approved','rejected','executed')
        and "company_receipt_pack_purge_request"."reviewed_by_user_id" is not null
        and "company_receipt_pack_purge_request"."reviewed_by_user_id" <> "company_receipt_pack_purge_request"."initiated_by_user_id"
        and char_length("company_receipt_pack_purge_request"."review_reason") between 3 and 1000
        and "company_receipt_pack_purge_request"."reviewed_at" is not null)),
	CONSTRAINT "ck_company_receipt_pack_purge_request_execution" CHECK (("company_receipt_pack_purge_request"."status" = 'executed'
      and "company_receipt_pack_purge_request"."executed_by_user_id" is not null and "company_receipt_pack_purge_request"."executed_at" is not null)
      or ("company_receipt_pack_purge_request"."status" <> 'executed'
        and "company_receipt_pack_purge_request"."executed_by_user_id" is null and "company_receipt_pack_purge_request"."executed_at" is null)),
	CONSTRAINT "ck_company_receipt_pack_purge_request_version" CHECK ("company_receipt_pack_purge_request"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "company_receipt_pack_tombstone" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "company_receipt_pack_tombstone_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"purge_request_id" bigint NOT NULL,
	"original_pack_id" bigint NOT NULL,
	"pack_key_hash" text NOT NULL,
	"created_by_hash" text NOT NULL,
	"source_sha256" text NOT NULL,
	"visibility" text NOT NULL,
	"locale" text NOT NULL,
	"row_count" integer NOT NULL,
	"document_count" integer NOT NULL,
	"retention_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"initiated_by_user_id" bigint NOT NULL,
	"reviewed_by_user_id" bigint NOT NULL,
	"executed_by_user_id" bigint NOT NULL,
	"purged_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ck_company_receipt_pack_tombstone_hashes" CHECK (char_length("company_receipt_pack_tombstone"."pack_key_hash") = 64
      and "company_receipt_pack_tombstone"."pack_key_hash" ~ '^[0-9a-f]{64}$'
      and char_length("company_receipt_pack_tombstone"."created_by_hash") = 64
      and "company_receipt_pack_tombstone"."created_by_hash" ~ '^[0-9a-f]{64}$'
      and char_length("company_receipt_pack_tombstone"."source_sha256") = 64
      and "company_receipt_pack_tombstone"."source_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_company_receipt_pack_tombstone_visibility" CHECK ("company_receipt_pack_tombstone"."visibility" in ('own','company')),
	CONSTRAINT "ck_company_receipt_pack_tombstone_locale" CHECK ("company_receipt_pack_tombstone"."locale" in ('en','ms','zh','ja','vi')),
	CONSTRAINT "ck_company_receipt_pack_tombstone_counts" CHECK ("company_receipt_pack_tombstone"."row_count" between 1 and 5000 and "company_receipt_pack_tombstone"."document_count" between 1 and "company_receipt_pack_tombstone"."row_count"),
	CONSTRAINT "ck_company_receipt_pack_tombstone_two_person" CHECK ("company_receipt_pack_tombstone"."initiated_by_user_id" <> "company_receipt_pack_tombstone"."reviewed_by_user_id")
);
--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "time_zone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_receipt_pack" ADD COLUMN "retention_until" timestamp with time zone DEFAULT '9999-12-31T00:00:00Z' NOT NULL;--> statement-breakpoint
UPDATE "company_receipt_pack" p
SET "retention_until" = COALESCE((
  SELECT max(d."retention_until")
  FROM jsonb_array_elements(p."rows") row_data
  JOIN "managed_document" d
    ON d."master_fn" = p."master_fn"
   AND d."company_fn" = p."company_fn"
   AND d."id" = (row_data->>'documentId')::bigint
), p."retention_until");--> statement-breakpoint
ALTER TABLE "company_receipt_pack" ALTER COLUMN "retention_until" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "company_receipt_pack" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company_receipt_pack" ADD COLUMN "record_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_receipt_pack_governance_event" ADD CONSTRAINT "company_receipt_pack_governance_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_receipt_pack_purge_request" ADD CONSTRAINT "company_receipt_pack_purge_request_initiated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_receipt_pack_purge_request" ADD CONSTRAINT "company_receipt_pack_purge_request_reviewed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_receipt_pack_purge_request" ADD CONSTRAINT "company_receipt_pack_purge_request_executed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("executed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_receipt_pack_tombstone" ADD CONSTRAINT "company_receipt_pack_tombstone_purge_request_id_company_receipt_pack_purge_request_id_fk" FOREIGN KEY ("purge_request_id") REFERENCES "public"."company_receipt_pack_purge_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_receipt_pack_tombstone" ADD CONSTRAINT "company_receipt_pack_tombstone_initiated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_receipt_pack_tombstone" ADD CONSTRAINT "company_receipt_pack_tombstone_reviewed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_receipt_pack_tombstone" ADD CONSTRAINT "company_receipt_pack_tombstone_executed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("executed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_company_receipt_pack_governance_event" ON "company_receipt_pack_governance_event" USING btree ("master_fn","company_fn","pack_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_receipt_pack_purge_request_pack" ON "company_receipt_pack_purge_request" USING btree ("master_fn","company_fn","pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_receipt_pack_purge_request_key_hash" ON "company_receipt_pack_purge_request" USING btree ("master_fn","company_fn","pack_key_hash");--> statement-breakpoint
CREATE INDEX "idx_company_receipt_pack_purge_request_status" ON "company_receipt_pack_purge_request" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_receipt_pack_tombstone_request" ON "company_receipt_pack_tombstone" USING btree ("purge_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_receipt_pack_tombstone_key_hash" ON "company_receipt_pack_tombstone" USING btree ("master_fn","company_fn","pack_key_hash");--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "ck_company_time_zone" CHECK (char_length("company"."time_zone") between 1 and 80 and "company"."time_zone" !~ '[[:space:]]');--> statement-breakpoint
ALTER TABLE "company_receipt_pack" ADD CONSTRAINT "ck_company_receipt_pack_record_version" CHECK ("company_receipt_pack"."record_version" > 0);--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_company_receipt_pack_fact_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND current_setting('app.company_receipt_pack_governance_delete', true) = 'on'
    AND OLD.master_fn = current_setting('app.master_fn', true)
    AND OLD.company_fn = current_setting('app.company_fn', true)
  THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'company receipt pack facts are governed and cannot be deleted directly';
  END IF;
  IF OLD.master_fn IS DISTINCT FROM NEW.master_fn
    OR OLD.company_fn IS DISTINCT FROM NEW.company_fn
    OR OLD.pack_key IS DISTINCT FROM NEW.pack_key
    OR OLD.visibility IS DISTINCT FROM NEW.visibility
    OR OLD.locale IS DISTINCT FROM NEW.locale
    OR OLD.filters IS DISTINCT FROM NEW.filters
    OR OLD.rows IS DISTINCT FROM NEW.rows
    OR OLD.totals IS DISTINCT FROM NEW.totals
    OR OLD.source_sha256 IS DISTINCT FROM NEW.source_sha256
    OR OLD.row_count IS DISTINCT FROM NEW.row_count
    OR OLD.document_count IS DISTINCT FROM NEW.document_count
    OR OLD.retention_until IS DISTINCT FROM NEW.retention_until
    OR OLD.created_by_user_id IS DISTINCT FROM NEW.created_by_user_id
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
    OR OLD.legal_hold IS NOT DISTINCT FROM NEW.legal_hold
    OR NEW.record_version <> OLD.record_version + 1
  THEN
    RAISE EXCEPTION 'company receipt pack facts are immutable; use governed legal-hold commands';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_company_receipt_pack_fact_guard ON company_receipt_pack;--> statement-breakpoint
CREATE TRIGGER trg_company_receipt_pack_fact_guard
BEFORE UPDATE OR DELETE ON company_receipt_pack
FOR EACH ROW EXECUTE FUNCTION prevent_company_receipt_pack_fact_change();--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_company_receipt_pack_governance_event_immutable ON company_receipt_pack_governance_event;--> statement-breakpoint
CREATE TRIGGER trg_company_receipt_pack_governance_event_immutable
BEFORE UPDATE OR DELETE ON company_receipt_pack_governance_event
FOR EACH ROW EXECUTE FUNCTION prevent_tax_evidence_fact_change();--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_company_receipt_pack_tombstone_immutable ON company_receipt_pack_tombstone;--> statement-breakpoint
CREATE TRIGGER trg_company_receipt_pack_tombstone_immutable
BEFORE UPDATE OR DELETE ON company_receipt_pack_tombstone
FOR EACH ROW EXECUTE FUNCTION prevent_tax_evidence_fact_change();
