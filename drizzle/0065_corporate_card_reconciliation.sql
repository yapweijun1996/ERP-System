-- TASK-126: bounded corporate-card imports, reviewable matches, and follow-up.
CREATE TABLE "corporate_card_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "corporate_card_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"import_id" bigint NOT NULL,
	"transaction_id" bigint,
	"event_type" text NOT NULL,
	"reason" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_corporate_card_event_type" CHECK ("corporate_card_event"."event_type" in (
      'imported','match_suggested','match_accepted','match_rejected',
      'follow_up_opened','follow_up_resolved','follow_up_waived'
    )),
	CONSTRAINT "ck_corporate_card_event_reason" CHECK (char_length("corporate_card_event"."reason") between 3 and 1000)
);
--> statement-breakpoint
CREATE TABLE "corporate_card_follow_up" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "corporate_card_follow_up_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"transaction_id" bigint NOT NULL,
	"follow_up_type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_employee_id" bigint,
	"reason" text NOT NULL,
	"resolution_reason" text,
	"resolved_by_user_id" bigint,
	"resolved_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_corporate_card_follow_up_type" CHECK ("corporate_card_follow_up"."follow_up_type" in ('holder_unresolved','missing_receipt','unmatched_transaction')),
	CONSTRAINT "ck_corporate_card_follow_up_status" CHECK ("corporate_card_follow_up"."status" in ('open','resolved','waived')),
	CONSTRAINT "ck_corporate_card_follow_up_reason" CHECK (char_length("corporate_card_follow_up"."reason") between 3 and 1000),
	CONSTRAINT "ck_corporate_card_follow_up_resolution" CHECK (("corporate_card_follow_up"."status" = 'open'
      and "corporate_card_follow_up"."resolution_reason" is null
      and "corporate_card_follow_up"."resolved_by_user_id" is null
      and "corporate_card_follow_up"."resolved_at" is null)
      or ("corporate_card_follow_up"."status" in ('resolved','waived')
        and char_length("corporate_card_follow_up"."resolution_reason") between 3 and 1000
        and "corporate_card_follow_up"."resolved_by_user_id" is not null
        and "corporate_card_follow_up"."resolved_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "corporate_card_import" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "corporate_card_import_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"import_key" text NOT NULL,
	"issuer" text NOT NULL,
	"statement_ref" text NOT NULL,
	"file_name" text NOT NULL,
	"file_format" text NOT NULL,
	"source_sha256" text NOT NULL,
	"row_count" integer NOT NULL,
	"imported_by_user_id" bigint NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_corporate_card_import_format" CHECK ("corporate_card_import"."file_format" in ('csv','xlsx')),
	CONSTRAINT "ck_corporate_card_import_hash" CHECK (char_length("corporate_card_import"."source_sha256") = 64
      and "corporate_card_import"."source_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_corporate_card_import_rows" CHECK ("corporate_card_import"."row_count" between 1 and 1000),
	CONSTRAINT "ck_corporate_card_import_text" CHECK (char_length("corporate_card_import"."import_key") between 8 and 128
      and char_length("corporate_card_import"."issuer") between 2 and 120
      and char_length("corporate_card_import"."statement_ref") between 2 and 120
      and char_length("corporate_card_import"."file_name") between 1 and 240)
);
--> statement-breakpoint
CREATE TABLE "corporate_card_match_candidate" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "corporate_card_match_candidate_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"transaction_id" bigint NOT NULL,
	"receipt_inbox_item_id" bigint NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"reasons" jsonb NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"reviewed_by_user_id" bigint,
	"review_reason" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_corporate_card_match_candidate_confidence" CHECK ("corporate_card_match_candidate"."confidence" between 0.0000 and 1.0000),
	CONSTRAINT "ck_corporate_card_match_candidate_status" CHECK ("corporate_card_match_candidate"."status" in ('suggested','accepted','rejected')),
	CONSTRAINT "ck_corporate_card_match_candidate_review" CHECK (("corporate_card_match_candidate"."status" = 'suggested'
      and "corporate_card_match_candidate"."reviewed_by_user_id" is null
      and "corporate_card_match_candidate"."review_reason" is null
      and "corporate_card_match_candidate"."reviewed_at" is null)
      or ("corporate_card_match_candidate"."status" in ('accepted','rejected')
        and "corporate_card_match_candidate"."reviewed_by_user_id" is not null
        and char_length("corporate_card_match_candidate"."review_reason") between 3 and 1000
        and "corporate_card_match_candidate"."reviewed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "corporate_card_transaction" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "corporate_card_transaction_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"import_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"external_transaction_id" text NOT NULL,
	"holder_employee_no" text NOT NULL,
	"holder_employee_id" bigint,
	"card_last4" text NOT NULL,
	"transaction_date" date NOT NULL,
	"posted_date" date NOT NULL,
	"merchant" text NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"line_fingerprint" text NOT NULL,
	"status" text DEFAULT 'unmatched' NOT NULL,
	"matched_receipt_inbox_item_id" bigint,
	"match_confidence" numeric(5, 4),
	"match_method" text,
	"matched_by_user_id" bigint,
	"matched_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_corporate_card_transaction_line" CHECK ("corporate_card_transaction"."line_no" > 0),
	CONSTRAINT "ck_corporate_card_transaction_card" CHECK ("corporate_card_transaction"."card_last4" ~ '^[0-9]{4}$'),
	CONSTRAINT "ck_corporate_card_transaction_dates" CHECK ("corporate_card_transaction"."posted_date" >= "corporate_card_transaction"."transaction_date"),
	CONSTRAINT "ck_corporate_card_transaction_currency" CHECK ("corporate_card_transaction"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_corporate_card_transaction_amount" CHECK ("corporate_card_transaction"."amount" > 0),
	CONSTRAINT "ck_corporate_card_transaction_hash" CHECK (char_length("corporate_card_transaction"."line_fingerprint") = 64
      and "corporate_card_transaction"."line_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_corporate_card_transaction_status" CHECK ("corporate_card_transaction"."status" in ('unmatched','suggested','matched','missing_receipt','waived')),
	CONSTRAINT "ck_corporate_card_transaction_match" CHECK (("corporate_card_transaction"."status" = 'matched'
      and "corporate_card_transaction"."matched_receipt_inbox_item_id" is not null
      and "corporate_card_transaction"."match_confidence" between 0.0000 and 1.0000
      and "corporate_card_transaction"."match_method" in ('automatic_review','manual')
      and "corporate_card_transaction"."matched_by_user_id" is not null
      and "corporate_card_transaction"."matched_at" is not null)
      or ("corporate_card_transaction"."status" <> 'matched'
        and "corporate_card_transaction"."matched_receipt_inbox_item_id" is null
        and "corporate_card_transaction"."match_confidence" is null
        and "corporate_card_transaction"."match_method" is null
        and "corporate_card_transaction"."matched_by_user_id" is null
        and "corporate_card_transaction"."matched_at" is null)),
	CONSTRAINT "ck_corporate_card_transaction_version" CHECK ("corporate_card_transaction"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "corporate_card_event" ADD CONSTRAINT "corporate_card_event_import_id_corporate_card_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."corporate_card_import"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_event" ADD CONSTRAINT "corporate_card_event_transaction_id_corporate_card_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."corporate_card_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_event" ADD CONSTRAINT "corporate_card_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_follow_up" ADD CONSTRAINT "corporate_card_follow_up_transaction_id_corporate_card_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."corporate_card_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_follow_up" ADD CONSTRAINT "corporate_card_follow_up_assigned_employee_id_employee_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_follow_up" ADD CONSTRAINT "corporate_card_follow_up_resolved_by_user_id_app_user_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_import" ADD CONSTRAINT "corporate_card_import_imported_by_user_id_app_user_user_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_match_candidate" ADD CONSTRAINT "corporate_card_match_candidate_transaction_id_corporate_card_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."corporate_card_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_match_candidate" ADD CONSTRAINT "corporate_card_match_candidate_receipt_inbox_item_id_receipt_inbox_item_id_fk" FOREIGN KEY ("receipt_inbox_item_id") REFERENCES "public"."receipt_inbox_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_match_candidate" ADD CONSTRAINT "corporate_card_match_candidate_reviewed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_transaction" ADD CONSTRAINT "corporate_card_transaction_import_id_corporate_card_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."corporate_card_import"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_transaction" ADD CONSTRAINT "corporate_card_transaction_holder_employee_id_employee_id_fk" FOREIGN KEY ("holder_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_transaction" ADD CONSTRAINT "corporate_card_transaction_matched_receipt_inbox_item_id_receipt_inbox_item_id_fk" FOREIGN KEY ("matched_receipt_inbox_item_id") REFERENCES "public"."receipt_inbox_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_card_transaction" ADD CONSTRAINT "corporate_card_transaction_matched_by_user_id_app_user_user_id_fk" FOREIGN KEY ("matched_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_corporate_card_event_import" ON "corporate_card_event" USING btree ("master_fn","company_fn","import_id","id");--> statement-breakpoint
CREATE INDEX "idx_corporate_card_event_transaction" ON "corporate_card_event" USING btree ("master_fn","company_fn","transaction_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_corporate_card_follow_up" ON "corporate_card_follow_up" USING btree ("master_fn","company_fn","transaction_id","follow_up_type");--> statement-breakpoint
CREATE INDEX "idx_corporate_card_follow_up_queue" ON "corporate_card_follow_up" USING btree ("master_fn","company_fn","status","due_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_corporate_card_import_key" ON "corporate_card_import" USING btree ("master_fn","company_fn","import_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_corporate_card_import_source" ON "corporate_card_import" USING btree ("master_fn","company_fn","source_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_corporate_card_import_statement" ON "corporate_card_import" USING btree ("master_fn","company_fn","issuer","statement_ref");--> statement-breakpoint
CREATE INDEX "idx_corporate_card_import_time" ON "corporate_card_import" USING btree ("master_fn","company_fn","imported_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_corporate_card_match_candidate" ON "corporate_card_match_candidate" USING btree ("master_fn","company_fn","transaction_id","receipt_inbox_item_id");--> statement-breakpoint
CREATE INDEX "idx_corporate_card_match_candidate_status" ON "corporate_card_match_candidate" USING btree ("master_fn","company_fn","status","confidence","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_corporate_card_transaction_import_line" ON "corporate_card_transaction" USING btree ("master_fn","company_fn","import_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_corporate_card_transaction_external" ON "corporate_card_transaction" USING btree ("master_fn","company_fn","external_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_corporate_card_transaction_fingerprint" ON "corporate_card_transaction" USING btree ("master_fn","company_fn","line_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_corporate_card_transaction_receipt" ON "corporate_card_transaction" USING btree ("master_fn","company_fn","matched_receipt_inbox_item_id") WHERE "corporate_card_transaction"."matched_receipt_inbox_item_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_corporate_card_transaction_queue" ON "corporate_card_transaction" USING btree ("master_fn","company_fn","status","posted_date","id");--> statement-breakpoint
CREATE INDEX "idx_corporate_card_transaction_holder" ON "corporate_card_transaction" USING btree ("master_fn","company_fn","holder_employee_id","status","id");--> statement-breakpoint
INSERT INTO "role_permission" ("master_fn", "role_id", "permission_key", "allowed")
SELECT "master_fn", "role_id", 'expenses.card.manage', true
FROM "role"
WHERE "name" IN ('Finance', 'Finance Manager')
ON CONFLICT ("role_id", "permission_key") DO NOTHING;--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_corporate_card_fact_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_corporate_card_transaction_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.master_fn IS DISTINCT FROM NEW.master_fn
    OR OLD.company_fn IS DISTINCT FROM NEW.company_fn
    OR OLD.import_id IS DISTINCT FROM NEW.import_id
    OR OLD.line_no IS DISTINCT FROM NEW.line_no
    OR OLD.external_transaction_id IS DISTINCT FROM NEW.external_transaction_id
    OR OLD.holder_employee_no IS DISTINCT FROM NEW.holder_employee_no
    OR OLD.holder_employee_id IS DISTINCT FROM NEW.holder_employee_id
    OR OLD.card_last4 IS DISTINCT FROM NEW.card_last4
    OR OLD.transaction_date IS DISTINCT FROM NEW.transaction_date
    OR OLD.posted_date IS DISTINCT FROM NEW.posted_date
    OR OLD.merchant IS DISTINCT FROM NEW.merchant
    OR OLD.currency IS DISTINCT FROM NEW.currency
    OR OLD.amount IS DISTINCT FROM NEW.amount
    OR OLD.line_fingerprint IS DISTINCT FROM NEW.line_fingerprint
    OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'corporate card transaction source facts are immutable';
  END IF;
  IF OLD.status IN ('matched','waived') THEN
    RAISE EXCEPTION 'terminal corporate card transaction is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_corporate_card_candidate_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.master_fn IS DISTINCT FROM NEW.master_fn
    OR OLD.company_fn IS DISTINCT FROM NEW.company_fn
    OR OLD.transaction_id IS DISTINCT FROM NEW.transaction_id
    OR OLD.receipt_inbox_item_id IS DISTINCT FROM NEW.receipt_inbox_item_id
    OR OLD.confidence IS DISTINCT FROM NEW.confidence
    OR OLD.reasons IS DISTINCT FROM NEW.reasons
    OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'corporate card match evidence is immutable';
  END IF;
  IF OLD.status <> 'suggested' THEN
    RAISE EXCEPTION 'reviewed corporate card match is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_corporate_card_follow_up_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.master_fn IS DISTINCT FROM NEW.master_fn
    OR OLD.company_fn IS DISTINCT FROM NEW.company_fn
    OR OLD.transaction_id IS DISTINCT FROM NEW.transaction_id
    OR OLD.follow_up_type IS DISTINCT FROM NEW.follow_up_type
    OR OLD.assigned_employee_id IS DISTINCT FROM NEW.assigned_employee_id
    OR OLD.reason IS DISTINCT FROM NEW.reason
    OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'corporate card follow-up source facts are immutable';
  END IF;
  IF OLD.status <> 'open' THEN
    RAISE EXCEPTION 'terminal corporate card follow-up is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS corporate_card_import_immutable ON corporate_card_import;--> statement-breakpoint
CREATE TRIGGER corporate_card_import_immutable
BEFORE UPDATE OR DELETE ON corporate_card_import
FOR EACH ROW EXECUTE FUNCTION prevent_corporate_card_fact_delete();--> statement-breakpoint
DROP TRIGGER IF EXISTS corporate_card_event_append_only ON corporate_card_event;--> statement-breakpoint
CREATE TRIGGER corporate_card_event_append_only
BEFORE UPDATE OR DELETE ON corporate_card_event
FOR EACH ROW EXECUTE FUNCTION prevent_corporate_card_fact_delete();--> statement-breakpoint
DROP TRIGGER IF EXISTS corporate_card_transaction_projection
ON corporate_card_transaction;--> statement-breakpoint
CREATE TRIGGER corporate_card_transaction_projection
BEFORE UPDATE ON corporate_card_transaction
FOR EACH ROW EXECUTE FUNCTION enforce_corporate_card_transaction_update();--> statement-breakpoint
DROP TRIGGER IF EXISTS corporate_card_transaction_no_delete
ON corporate_card_transaction;--> statement-breakpoint
CREATE TRIGGER corporate_card_transaction_no_delete
BEFORE DELETE ON corporate_card_transaction
FOR EACH ROW EXECUTE FUNCTION prevent_corporate_card_fact_delete();--> statement-breakpoint
DROP TRIGGER IF EXISTS corporate_card_candidate_projection
ON corporate_card_match_candidate;--> statement-breakpoint
CREATE TRIGGER corporate_card_candidate_projection
BEFORE UPDATE ON corporate_card_match_candidate
FOR EACH ROW EXECUTE FUNCTION enforce_corporate_card_candidate_update();--> statement-breakpoint
DROP TRIGGER IF EXISTS corporate_card_candidate_no_delete
ON corporate_card_match_candidate;--> statement-breakpoint
CREATE TRIGGER corporate_card_candidate_no_delete
BEFORE DELETE ON corporate_card_match_candidate
FOR EACH ROW EXECUTE FUNCTION prevent_corporate_card_fact_delete();--> statement-breakpoint
DROP TRIGGER IF EXISTS corporate_card_follow_up_projection
ON corporate_card_follow_up;--> statement-breakpoint
CREATE TRIGGER corporate_card_follow_up_projection
BEFORE UPDATE ON corporate_card_follow_up
FOR EACH ROW EXECUTE FUNCTION enforce_corporate_card_follow_up_update();--> statement-breakpoint
DROP TRIGGER IF EXISTS corporate_card_follow_up_no_delete
ON corporate_card_follow_up;--> statement-breakpoint
CREATE TRIGGER corporate_card_follow_up_no_delete
BEFORE DELETE ON corporate_card_follow_up
FOR EACH ROW EXECUTE FUNCTION prevent_corporate_card_fact_delete();
