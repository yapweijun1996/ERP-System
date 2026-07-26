CREATE TABLE "reimbursement_payment_batch" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reimbursement_payment_batch_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"batch_key" text NOT NULL,
	"batch_no" text NOT NULL,
	"currency" text NOT NULL,
	"source_bank_account_id" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"prepared_by_user_id" bigint NOT NULL,
	"prepared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_by_user_id" bigint,
	"released_at" timestamp with time zone,
	"release_reason" text,
	"release_facts_sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reimbursement_payment_batch_key" CHECK ("reimbursement_payment_batch"."batch_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_reimbursement_payment_batch_no" CHECK (char_length("reimbursement_payment_batch"."batch_no") between 3 and 80),
	CONSTRAINT "ck_reimbursement_payment_batch_currency" CHECK ("reimbursement_payment_batch"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_reimbursement_payment_batch_status" CHECK ("reimbursement_payment_batch"."status" in ('draft','released')),
	CONSTRAINT "ck_reimbursement_payment_batch_version" CHECK ("reimbursement_payment_batch"."version" > 0),
	CONSTRAINT "ck_reimbursement_payment_batch_totals" CHECK ("reimbursement_payment_batch"."item_count" >= 0 and "reimbursement_payment_batch"."total_amount" >= 0),
	CONSTRAINT "ck_reimbursement_payment_batch_release" CHECK (("reimbursement_payment_batch"."status" = 'draft'
      and "reimbursement_payment_batch"."released_by_user_id" is null
      and "reimbursement_payment_batch"."released_at" is null
      and "reimbursement_payment_batch"."release_reason" is null
      and "reimbursement_payment_batch"."release_facts_sha256" is null)
    or ("reimbursement_payment_batch"."status" = 'released'
      and "reimbursement_payment_batch"."item_count" > 0
      and "reimbursement_payment_batch"."total_amount" > 0
      and "reimbursement_payment_batch"."released_by_user_id" is not null
      and "reimbursement_payment_batch"."released_by_user_id" <> "reimbursement_payment_batch"."prepared_by_user_id"
      and "reimbursement_payment_batch"."released_at" is not null
      and char_length("reimbursement_payment_batch"."release_reason") between 3 and 500
      and char_length("reimbursement_payment_batch"."release_facts_sha256") = 64
      and "reimbursement_payment_batch"."release_facts_sha256" ~ '^[0-9a-f]{64}$'))
);
--> statement-breakpoint
CREATE TABLE "reimbursement_payment_batch_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reimbursement_payment_batch_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"batch_id" bigint NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"batch_version" integer NOT NULL,
	"reason" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reimbursement_payment_batch_event_type" CHECK ("reimbursement_payment_batch_event"."event_type" in ('created','membership_replaced','released')),
	CONSTRAINT "ck_reimbursement_payment_batch_event_version" CHECK ("reimbursement_payment_batch_event"."batch_version" > 0),
	CONSTRAINT "ck_reimbursement_payment_batch_event_reason" CHECK ("reimbursement_payment_batch_event"."reason" is null or char_length("reimbursement_payment_batch_event"."reason") between 3 and 500)
);
--> statement-breakpoint
CREATE TABLE "reimbursement_payment_batch_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reimbursement_payment_batch_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"batch_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"expense_posting_id" bigint NOT NULL,
	"claim_id" bigint NOT NULL,
	"claim_line_id" bigint NOT NULL,
	"owner_user_id" bigint NOT NULL,
	"employee_id" bigint NOT NULL,
	"payout_profile_id" bigint NOT NULL,
	"payout_profile_version" integer NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"payable_account_id" bigint NOT NULL,
	"claim_no" text NOT NULL,
	"account_holder_masked" text NOT NULL,
	"account_number_masked" text NOT NULL,
	"bank_name" text NOT NULL,
	"payout_envelope_snapshot" jsonb,
	"posting_facts_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reimbursement_payment_batch_line_no" CHECK ("reimbursement_payment_batch_line"."line_no" > 0),
	CONSTRAINT "ck_reimbursement_payment_batch_line_profile_version" CHECK ("reimbursement_payment_batch_line"."payout_profile_version" > 0),
	CONSTRAINT "ck_reimbursement_payment_batch_line_currency" CHECK ("reimbursement_payment_batch_line"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_reimbursement_payment_batch_line_amount" CHECK ("reimbursement_payment_batch_line"."amount" > 0),
	CONSTRAINT "ck_reimbursement_payment_batch_line_masks" CHECK (char_length("reimbursement_payment_batch_line"."account_holder_masked") between 2 and 160
      and char_length("reimbursement_payment_batch_line"."account_number_masked") between 4 and 40
      and char_length("reimbursement_payment_batch_line"."bank_name") between 2 and 120),
	CONSTRAINT "ck_reimbursement_payment_batch_line_hash" CHECK (char_length("reimbursement_payment_batch_line"."posting_facts_sha256") = 64
      and "reimbursement_payment_batch_line"."posting_facts_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch" ADD CONSTRAINT "reimbursement_payment_batch_currency_currency_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch" ADD CONSTRAINT "reimbursement_payment_batch_source_bank_account_id_account_id_fk" FOREIGN KEY ("source_bank_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch" ADD CONSTRAINT "reimbursement_payment_batch_prepared_by_user_id_app_user_user_id_fk" FOREIGN KEY ("prepared_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch" ADD CONSTRAINT "reimbursement_payment_batch_released_by_user_id_app_user_user_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch_event" ADD CONSTRAINT "reimbursement_payment_batch_event_batch_id_reimbursement_payment_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."reimbursement_payment_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch_event" ADD CONSTRAINT "reimbursement_payment_batch_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch_line" ADD CONSTRAINT "reimbursement_payment_batch_line_batch_id_reimbursement_payment_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."reimbursement_payment_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch_line" ADD CONSTRAINT "reimbursement_payment_batch_line_expense_posting_id_expense_posting_id_fk" FOREIGN KEY ("expense_posting_id") REFERENCES "public"."expense_posting"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch_line" ADD CONSTRAINT "reimbursement_payment_batch_line_claim_id_expense_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch_line" ADD CONSTRAINT "reimbursement_payment_batch_line_claim_line_id_expense_claim_line_id_fk" FOREIGN KEY ("claim_line_id") REFERENCES "public"."expense_claim_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch_line" ADD CONSTRAINT "reimbursement_payment_batch_line_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch_line" ADD CONSTRAINT "reimbursement_payment_batch_line_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch_line" ADD CONSTRAINT "reimbursement_payment_batch_line_payout_profile_id_employee_payout_profile_id_fk" FOREIGN KEY ("payout_profile_id") REFERENCES "public"."employee_payout_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch_line" ADD CONSTRAINT "reimbursement_payment_batch_line_currency_currency_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_payment_batch_line" ADD CONSTRAINT "reimbursement_payment_batch_line_payable_account_id_account_id_fk" FOREIGN KEY ("payable_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_payment_batch_key" ON "reimbursement_payment_batch" USING btree ("master_fn","company_fn","batch_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_payment_batch_no" ON "reimbursement_payment_batch" USING btree ("master_fn","company_fn","batch_no");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_payment_batch_status" ON "reimbursement_payment_batch" USING btree ("master_fn","company_fn","status","prepared_at","id");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_payment_batch_event" ON "reimbursement_payment_batch_event" USING btree ("master_fn","company_fn","batch_id","id");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_payment_batch_event_actor" ON "reimbursement_payment_batch_event" USING btree ("master_fn","company_fn","actor_user_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_payment_batch_line_no" ON "reimbursement_payment_batch_line" USING btree ("master_fn","company_fn","batch_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_payment_batch_posting" ON "reimbursement_payment_batch_line" USING btree ("master_fn","company_fn","expense_posting_id");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_payment_batch_line_employee" ON "reimbursement_payment_batch_line" USING btree ("master_fn","company_fn","employee_id","batch_id","id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_reimbursement_payment_event_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'reimbursement payment batch events are immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_reimbursement_payment_batch()
RETURNS trigger AS $$
DECLARE
  actual_count integer;
  actual_total numeric(18,2);
  missing_snapshots integer;
BEGIN
  IF OLD.status = 'released' THEN
    RAISE EXCEPTION 'released reimbursement payment batch is immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'released' THEN
    SELECT count(*), coalesce(sum(amount), 0),
      count(*) FILTER (WHERE payout_envelope_snapshot IS NULL)
    INTO actual_count, actual_total, missing_snapshots
    FROM reimbursement_payment_batch_line
    WHERE master_fn = NEW.master_fn
      AND company_fn = NEW.company_fn
      AND batch_id = NEW.id;
    IF actual_count <> NEW.item_count
      OR actual_total <> NEW.total_amount
      OR missing_snapshots <> 0 THEN
      RAISE EXCEPTION 'reimbursement payment release snapshot is incomplete';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM reimbursement_payment_batch_line
      WHERE master_fn = NEW.master_fn
        AND company_fn = NEW.company_fn
        AND batch_id = NEW.id
        AND owner_user_id = NEW.released_by_user_id
    ) THEN
      RAISE EXCEPTION 'releaser cannot approve their own reimbursement';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM reimbursement_payment_batch_line line
      LEFT JOIN employee_payout_profile profile
        ON profile.id = line.payout_profile_id
       AND profile.master_fn = line.master_fn
       AND profile.company_fn = line.company_fn
      WHERE line.master_fn = NEW.master_fn
        AND line.company_fn = NEW.company_fn
        AND line.batch_id = NEW.id
        AND (
          profile.id IS NULL
          OR profile.verification_status <> 'verified'
          OR profile.version <> line.payout_profile_version
          OR profile.employee_id <> line.employee_id
          OR profile.currency <> line.currency
        )
    ) THEN
      RAISE EXCEPTION 'reimbursement payout profile changed before release';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_reimbursement_payment_batch_line()
RETURNS trigger AS $$
DECLARE
  target_batch_id bigint;
  target_master_fn text;
  target_company_fn text;
  batch_status text;
BEGIN
  target_batch_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.batch_id ELSE NEW.batch_id END;
  target_master_fn := CASE WHEN TG_OP = 'DELETE' THEN OLD.master_fn ELSE NEW.master_fn END;
  target_company_fn := CASE WHEN TG_OP = 'DELETE' THEN OLD.company_fn ELSE NEW.company_fn END;
  SELECT status INTO batch_status
  FROM reimbursement_payment_batch
  WHERE id = target_batch_id
    AND master_fn = target_master_fn
    AND company_fn = target_company_fn;
  IF batch_status = 'released' THEN
    RAISE EXCEPTION 'released reimbursement payment membership is immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.batch_id <> NEW.batch_id THEN
    SELECT status INTO batch_status
    FROM reimbursement_payment_batch
    WHERE id = OLD.batch_id
      AND master_fn = OLD.master_fn
      AND company_fn = OLD.company_fn;
    IF batch_status = 'released' THEN
      RAISE EXCEPTION 'released reimbursement payment membership is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS reimbursement_payment_batch_guard
ON reimbursement_payment_batch;
--> statement-breakpoint
CREATE TRIGGER reimbursement_payment_batch_guard
BEFORE UPDATE OR DELETE ON reimbursement_payment_batch
FOR EACH ROW EXECUTE FUNCTION guard_reimbursement_payment_batch();
--> statement-breakpoint
DROP TRIGGER IF EXISTS reimbursement_payment_batch_line_guard
ON reimbursement_payment_batch_line;
--> statement-breakpoint
CREATE TRIGGER reimbursement_payment_batch_line_guard
BEFORE INSERT OR UPDATE OR DELETE ON reimbursement_payment_batch_line
FOR EACH ROW EXECUTE FUNCTION guard_reimbursement_payment_batch_line();
--> statement-breakpoint
DROP TRIGGER IF EXISTS reimbursement_payment_batch_event_immutable
ON reimbursement_payment_batch_event;
--> statement-breakpoint
CREATE TRIGGER reimbursement_payment_batch_event_immutable
BEFORE UPDATE OR DELETE ON reimbursement_payment_batch_event
FOR EACH ROW EXECUTE FUNCTION prevent_reimbursement_payment_event_change();
