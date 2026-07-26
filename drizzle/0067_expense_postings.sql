-- TASK-128: idempotent final-approved expense posting with immutable GL links.
CREATE TABLE "expense_posting" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_posting_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"line_approval_id" bigint NOT NULL,
	"claim_id" bigint NOT NULL,
	"line_id" bigint NOT NULL,
	"claim_version" integer NOT NULL,
	"policy_snapshot_id" bigint NOT NULL,
	"bank_charge_override_id" bigint,
	"accounting_period_id" bigint NOT NULL,
	"journal_ref" text NOT NULL,
	"posting_date" date NOT NULL,
	"payment_source" text NOT NULL,
	"functional_currency" text NOT NULL,
	"base_expense" numeric(18, 2) NOT NULL,
	"base_input_tax" numeric(18, 2) NOT NULL,
	"base_gross" numeric(18, 2) NOT NULL,
	"credit_account_id" bigint NOT NULL,
	"facts_sha256" text NOT NULL,
	"posted_by_user_id" bigint NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_posting_version" CHECK ("expense_posting"."claim_version" > 0),
	CONSTRAINT "ck_expense_posting_payment" CHECK ("expense_posting"."payment_source" in ('employee_paid','company_paid')),
	CONSTRAINT "ck_expense_posting_currency" CHECK ("expense_posting"."functional_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_expense_posting_amounts" CHECK ("expense_posting"."base_expense" >= 0 and "expense_posting"."base_input_tax" >= 0 and "expense_posting"."base_gross" > 0
      and "expense_posting"."base_expense" + "expense_posting"."base_input_tax" = "expense_posting"."base_gross"),
	CONSTRAINT "ck_expense_posting_hash" CHECK (char_length("expense_posting"."facts_sha256") = 64
      and "expense_posting"."facts_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "expense_posting_leg" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_posting_leg_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"posting_id" bigint NOT NULL,
	"leg_no" integer NOT NULL,
	"leg_type" text NOT NULL,
	"account_id" bigint NOT NULL,
	"debit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"gl_entry_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_posting_leg_no" CHECK ("expense_posting_leg"."leg_no" > 0),
	CONSTRAINT "ck_expense_posting_leg_type" CHECK ("expense_posting_leg"."leg_type" in ('expense','input_tax','credit')),
	CONSTRAINT "ck_expense_posting_leg_side" CHECK (("expense_posting_leg"."debit" > 0 and "expense_posting_leg"."credit" = 0)
      or ("expense_posting_leg"."credit" > 0 and "expense_posting_leg"."debit" = 0))
);
--> statement-breakpoint
ALTER TABLE "expense_posting" ADD CONSTRAINT "expense_posting_line_approval_id_expense_line_approval_id_fk" FOREIGN KEY ("line_approval_id") REFERENCES "public"."expense_line_approval"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_posting" ADD CONSTRAINT "expense_posting_claim_id_expense_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_posting" ADD CONSTRAINT "expense_posting_line_id_expense_claim_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."expense_claim_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_posting" ADD CONSTRAINT "expense_posting_policy_snapshot_id_expense_line_policy_snapshot_id_fk" FOREIGN KEY ("policy_snapshot_id") REFERENCES "public"."expense_line_policy_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_posting" ADD CONSTRAINT "expense_posting_bank_charge_override_id_expense_bank_charge_override_id_fk" FOREIGN KEY ("bank_charge_override_id") REFERENCES "public"."expense_bank_charge_override"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_posting" ADD CONSTRAINT "expense_posting_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_posting" ADD CONSTRAINT "expense_posting_credit_account_id_account_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_posting" ADD CONSTRAINT "expense_posting_posted_by_user_id_app_user_user_id_fk" FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_posting_leg" ADD CONSTRAINT "expense_posting_leg_posting_id_expense_posting_id_fk" FOREIGN KEY ("posting_id") REFERENCES "public"."expense_posting"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_posting_leg" ADD CONSTRAINT "expense_posting_leg_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_posting_leg" ADD CONSTRAINT "expense_posting_leg_gl_entry_id_gl_entry_id_fk" FOREIGN KEY ("gl_entry_id") REFERENCES "public"."gl_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_posting_line_approval" ON "expense_posting" USING btree ("master_fn","company_fn","line_approval_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_posting_journal" ON "expense_posting" USING btree ("master_fn","company_fn","journal_ref");--> statement-breakpoint
CREATE INDEX "idx_expense_posting_date" ON "expense_posting" USING btree ("master_fn","company_fn","posting_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_posting_leg_no" ON "expense_posting_leg" USING btree ("master_fn","company_fn","posting_id","leg_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_posting_leg_gl" ON "expense_posting_leg" USING btree ("master_fn","company_fn","gl_entry_id");--> statement-breakpoint
CREATE INDEX "idx_expense_posting_leg_posting" ON "expense_posting_leg" USING btree ("master_fn","company_fn","posting_id","id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_expense_posting_fact_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_linked_expense_gl_change()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM expense_posting_leg WHERE gl_entry_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'linked expense GL entry is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_posting_immutable ON expense_posting;
--> statement-breakpoint
CREATE TRIGGER expense_posting_immutable
BEFORE UPDATE OR DELETE ON expense_posting
FOR EACH ROW EXECUTE FUNCTION prevent_expense_posting_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_posting_leg_immutable ON expense_posting_leg;
--> statement-breakpoint
CREATE TRIGGER expense_posting_leg_immutable
BEFORE UPDATE OR DELETE ON expense_posting_leg
FOR EACH ROW EXECUTE FUNCTION prevent_expense_posting_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS linked_expense_gl_immutable ON gl_entry;
--> statement-breakpoint
CREATE TRIGGER linked_expense_gl_immutable
BEFORE UPDATE OR DELETE ON gl_entry
FOR EACH ROW EXECUTE FUNCTION prevent_linked_expense_gl_change();
