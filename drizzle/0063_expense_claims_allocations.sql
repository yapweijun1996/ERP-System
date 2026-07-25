-- Employee-owned expense claim drafts, exact allocations and immutable submission records.
CREATE TABLE "expense_allocation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_allocation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"line_id" bigint NOT NULL,
	"allocation_no" integer NOT NULL,
	"mode" text NOT NULL,
	"dimension_type" text NOT NULL,
	"dimension_key" text NOT NULL,
	"amount_original" numeric(18, 4) NOT NULL,
	"percentage" numeric(7, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_allocation_no" CHECK ("expense_allocation"."allocation_no" > 0),
	CONSTRAINT "ck_expense_allocation_mode" CHECK ("expense_allocation"."mode" in ('amount','percentage')),
	CONSTRAINT "ck_expense_allocation_dimension" CHECK ("expense_allocation"."dimension_type" in ('department','cost_center','project')
      and char_length("expense_allocation"."dimension_key") between 1 and 80),
	CONSTRAINT "ck_expense_allocation_values" CHECK ("expense_allocation"."amount_original" >= 0 and "expense_allocation"."percentage" >= 0 and "expense_allocation"."percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "expense_claim" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_claim_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"claim_key" text NOT NULL,
	"claim_no" text NOT NULL,
	"owner_user_id" bigint NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"submission_kind" text DEFAULT 'none' NOT NULL,
	"submitted_by_user_id" bigint,
	"system_actor_key" text,
	"submitted_at" timestamp with time zone,
	"facts_sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_claim_key" CHECK ("expense_claim"."claim_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_expense_claim_title" CHECK (char_length("expense_claim"."title") between 3 and 160),
	CONSTRAINT "ck_expense_claim_status" CHECK ("expense_claim"."status" in (
      'draft','submitted','pending_approval','partially_approved',
      'approved','rejected','returned','voided','posted'
    )),
	CONSTRAINT "ck_expense_claim_version" CHECK ("expense_claim"."version" > 0),
	CONSTRAINT "ck_expense_claim_submission" CHECK (("expense_claim"."status" = 'draft'
      and "expense_claim"."submission_kind" = 'none'
      and "expense_claim"."submitted_by_user_id" is null
      and "expense_claim"."system_actor_key" is null
      and "expense_claim"."submitted_at" is null
      and "expense_claim"."facts_sha256" is null)
      or ("expense_claim"."status" <> 'draft'
        and "expense_claim"."submission_kind" in ('employee','system')
        and "expense_claim"."submitted_by_user_id" is not null
        and ("expense_claim"."submission_kind" = 'employee' and "expense_claim"."system_actor_key" is null
          or "expense_claim"."submission_kind" = 'system'
            and "expense_claim"."system_actor_key" = 'expense-auto-submit-v1')
        and "expense_claim"."submitted_at" is not null
        and char_length("expense_claim"."facts_sha256") = 64
        and "expense_claim"."facts_sha256" ~ '^[0-9a-f]{64}$'))
);
--> statement-breakpoint
CREATE TABLE "expense_claim_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_claim_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"claim_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"from_status" text,
	"to_status" text,
	"reason" text NOT NULL,
	"claim_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_claim_event_type" CHECK ("expense_claim_event"."event_type" in ('created','draft_replaced','submitted','system_submitted')),
	CONSTRAINT "ck_expense_claim_event_reason" CHECK (char_length("expense_claim_event"."reason") between 3 and 1000),
	CONSTRAINT "ck_expense_claim_event_version" CHECK ("expense_claim_event"."claim_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "expense_claim_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_claim_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"claim_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"merchant" text NOT NULL,
	"transaction_date" date NOT NULL,
	"purpose" text NOT NULL,
	"category_code" text NOT NULL,
	"payment_source" text NOT NULL,
	"original_currency" text NOT NULL,
	"original_net" numeric(18, 4) NOT NULL,
	"original_tax" numeric(18, 4) NOT NULL,
	"original_gross" numeric(18, 4) NOT NULL,
	"receipt_inbox_item_id" bigint,
	"policy_snapshot_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_claim_line_no" CHECK ("expense_claim_line"."line_no" > 0),
	CONSTRAINT "ck_expense_claim_line_text" CHECK (char_length("expense_claim_line"."merchant") between 1 and 160
      and char_length("expense_claim_line"."purpose") between 3 and 500
      and "expense_claim_line"."category_code" ~ '^[A-Z][A-Z0-9_-]{1,31}$'),
	CONSTRAINT "ck_expense_claim_line_payment" CHECK ("expense_claim_line"."payment_source" in ('employee_paid','company_paid')),
	CONSTRAINT "ck_expense_claim_line_amounts" CHECK ("expense_claim_line"."original_net" >= 0 and "expense_claim_line"."original_tax" >= 0 and "expense_claim_line"."original_gross" > 0
      and "expense_claim_line"."original_net" + "expense_claim_line"."original_tax" = "expense_claim_line"."original_gross")
);
--> statement-breakpoint
CREATE TABLE "expense_claim_revision" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_claim_revision_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"claim_id" bigint NOT NULL,
	"claim_version" integer NOT NULL,
	"facts_sha256" text NOT NULL,
	"facts" jsonb NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_claim_revision_version" CHECK ("expense_claim_revision"."claim_version" > 0),
	CONSTRAINT "ck_expense_claim_revision_hash" CHECK (char_length("expense_claim_revision"."facts_sha256") = 64
      and "expense_claim_revision"."facts_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "expense_claim_submission_authorization" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_claim_submission_authorization_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"claim_id" bigint NOT NULL,
	"owner_user_id" bigint NOT NULL,
	"auto_submit_authorized" boolean DEFAULT false NOT NULL,
	"authorized_at" timestamp with time zone,
	"statement_version" text DEFAULT 'expense-auto-submit-v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_claim_submission_authorization" CHECK (("expense_claim_submission_authorization"."auto_submit_authorized" and "expense_claim_submission_authorization"."authorized_at" is not null)
        or (not "expense_claim_submission_authorization"."auto_submit_authorized" and "expense_claim_submission_authorization"."authorized_at" is null)),
	CONSTRAINT "ck_expense_claim_submission_statement" CHECK ("expense_claim_submission_authorization"."statement_version" = 'expense-auto-submit-v1')
);
--> statement-breakpoint
ALTER TABLE "expense_allocation" ADD CONSTRAINT "expense_allocation_line_id_expense_claim_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."expense_claim_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim" ADD CONSTRAINT "expense_claim_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim" ADD CONSTRAINT "expense_claim_submitted_by_user_id_app_user_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim_event" ADD CONSTRAINT "expense_claim_event_claim_id_expense_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim_event" ADD CONSTRAINT "expense_claim_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim_line" ADD CONSTRAINT "expense_claim_line_claim_id_expense_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim_line" ADD CONSTRAINT "expense_claim_line_original_currency_currency_code_fk" FOREIGN KEY ("original_currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim_line" ADD CONSTRAINT "expense_claim_line_receipt_inbox_item_id_receipt_inbox_item_id_fk" FOREIGN KEY ("receipt_inbox_item_id") REFERENCES "public"."receipt_inbox_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim_line" ADD CONSTRAINT "expense_claim_line_policy_snapshot_id_expense_line_policy_snapshot_id_fk" FOREIGN KEY ("policy_snapshot_id") REFERENCES "public"."expense_line_policy_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim_revision" ADD CONSTRAINT "expense_claim_revision_claim_id_expense_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim_revision" ADD CONSTRAINT "expense_claim_revision_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim_submission_authorization" ADD CONSTRAINT "expense_claim_submission_authorization_claim_id_expense_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claim_submission_authorization" ADD CONSTRAINT "expense_claim_submission_authorization_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_allocation_number" ON "expense_allocation" USING btree ("master_fn","company_fn","line_id","allocation_no");--> statement-breakpoint
CREATE INDEX "idx_expense_allocation_dimension" ON "expense_allocation" USING btree ("master_fn","company_fn","dimension_type","dimension_key","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_claim_key" ON "expense_claim" USING btree ("master_fn","company_fn","claim_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_claim_number" ON "expense_claim" USING btree ("master_fn","company_fn","claim_no");--> statement-breakpoint
CREATE INDEX "idx_expense_claim_owner_status" ON "expense_claim" USING btree ("master_fn","company_fn","owner_user_id","status","id");--> statement-breakpoint
CREATE INDEX "idx_expense_claim_event_claim" ON "expense_claim_event" USING btree ("master_fn","company_fn","claim_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_claim_line_number" ON "expense_claim_line" USING btree ("master_fn","company_fn","claim_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_claim_line_receipt" ON "expense_claim_line" USING btree ("master_fn","company_fn","receipt_inbox_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_claim_line_snapshot" ON "expense_claim_line" USING btree ("master_fn","company_fn","policy_snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_expense_claim_line_claim" ON "expense_claim_line" USING btree ("master_fn","company_fn","claim_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_claim_revision" ON "expense_claim_revision" USING btree ("master_fn","company_fn","claim_id","claim_version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_claim_submission_authorization" ON "expense_claim_submission_authorization" USING btree ("master_fn","company_fn","claim_id");
--> statement-breakpoint
INSERT INTO "role_permission" ("master_fn", "role_id", "permission_key", "allowed")
SELECT "master_fn", "role_id", 'employee.claims.write', true
FROM "role"
WHERE "name" IN ('Employee', 'Manager')
ON CONFLICT ("role_id", "permission_key") DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_expense_claim_identity_and_facts()
RETURNS trigger AS $$
BEGIN
  IF OLD.master_fn IS DISTINCT FROM NEW.master_fn
    OR OLD.company_fn IS DISTINCT FROM NEW.company_fn
    OR OLD.claim_key IS DISTINCT FROM NEW.claim_key
    OR OLD.claim_no IS DISTINCT FROM NEW.claim_no
    OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id THEN
    RAISE EXCEPTION 'expense claim ownership and identity are immutable';
  END IF;
  IF OLD.status <> 'draft' AND OLD.title IS DISTINCT FROM NEW.title THEN
    RAISE EXCEPTION 'submitted employee-owned claim facts are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_claim_identity_and_facts ON expense_claim;
--> statement-breakpoint
CREATE TRIGGER expense_claim_identity_and_facts
BEFORE UPDATE ON expense_claim
FOR EACH ROW EXECUTE FUNCTION enforce_expense_claim_identity_and_facts();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_expense_claim_draft_child_mutation()
RETURNS trigger AS $$
DECLARE
  target_claim_id bigint;
  target_line_id bigint;
  target_status text;
BEGIN
  IF TG_TABLE_NAME = 'expense_claim_line' THEN
    target_claim_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.claim_id ELSE NEW.claim_id END;
  ELSE
    target_line_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.line_id ELSE NEW.line_id END;
    SELECT claim_id INTO target_claim_id
    FROM expense_claim_line
    WHERE id = target_line_id;
  END IF;
  SELECT status INTO target_status
  FROM expense_claim
  WHERE id = target_claim_id;
  IF target_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'submitted employee-owned claim facts are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_claim_line_draft_only ON expense_claim_line;
--> statement-breakpoint
CREATE TRIGGER expense_claim_line_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON expense_claim_line
FOR EACH ROW EXECUTE FUNCTION enforce_expense_claim_draft_child_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_allocation_draft_only ON expense_allocation;
--> statement-breakpoint
CREATE TRIGGER expense_allocation_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON expense_allocation
FOR EACH ROW EXECUTE FUNCTION enforce_expense_claim_draft_child_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_expense_claim_record_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_claim_authorization_immutable
ON expense_claim_submission_authorization;
--> statement-breakpoint
CREATE TRIGGER expense_claim_authorization_immutable
BEFORE UPDATE OR DELETE ON expense_claim_submission_authorization
FOR EACH ROW EXECUTE FUNCTION prevent_expense_claim_record_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_claim_revision_immutable ON expense_claim_revision;
--> statement-breakpoint
CREATE TRIGGER expense_claim_revision_immutable
BEFORE UPDATE OR DELETE ON expense_claim_revision
FOR EACH ROW EXECUTE FUNCTION prevent_expense_claim_record_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_claim_event_immutable ON expense_claim_event;
--> statement-breakpoint
CREATE TRIGGER expense_claim_event_immutable
BEFORE UPDATE OR DELETE ON expense_claim_event
FOR EACH ROW EXECUTE FUNCTION prevent_expense_claim_record_mutation();
