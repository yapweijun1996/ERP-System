-- TASK-127: versioned mileage/per-diem evidence and reconciled cash advances.
CREATE TABLE "cash_advance" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_advance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"advance_key" text NOT NULL,
	"advance_no" text NOT NULL,
	"employee_id" bigint NOT NULL,
	"owner_user_id" bigint NOT NULL,
	"currency" text NOT NULL,
	"issued_amount" numeric(18, 2) NOT NULL,
	"issued_date" date NOT NULL,
	"purpose" text NOT NULL,
	"advance_receivable_account_id" bigint NOT NULL,
	"employee_payable_account_id" bigint NOT NULL,
	"bank_account_id" bigint NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"applied_expense_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"employee_repaid_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"employee_payable_difference" numeric(18, 2) DEFAULT '0' NOT NULL,
	"closed_by_user_id" bigint,
	"closed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_cash_advance_currency" CHECK ("cash_advance"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_cash_advance_amounts" CHECK ("cash_advance"."issued_amount" > 0 and "cash_advance"."applied_expense_amount" >= 0
      and "cash_advance"."employee_repaid_amount" >= 0 and "cash_advance"."employee_payable_difference" >= 0),
	CONSTRAINT "ck_cash_advance_status" CHECK ("cash_advance"."status" in ('issued','closed')),
	CONSTRAINT "ck_cash_advance_close" CHECK (("cash_advance"."status" = 'issued'
      and "cash_advance"."applied_expense_amount" = 0 and "cash_advance"."employee_repaid_amount" = 0
      and "cash_advance"."employee_payable_difference" = 0
      and "cash_advance"."closed_by_user_id" is null and "cash_advance"."closed_at" is null)
      or ("cash_advance"."status" = 'closed'
        and "cash_advance"."closed_by_user_id" is not null and "cash_advance"."closed_at" is not null)),
	CONSTRAINT "ck_cash_advance_version" CHECK ("cash_advance"."version" > 0),
	CONSTRAINT "ck_cash_advance_purpose" CHECK (char_length("cash_advance"."purpose") between 3 and 500)
);
--> statement-breakpoint
CREATE TABLE "cash_advance_application" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_advance_application_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"advance_id" bigint NOT NULL,
	"source_type" text NOT NULL,
	"expense_claim_line_id" bigint,
	"allowance_calculation_id" bigint,
	"amount" numeric(18, 2) NOT NULL,
	"applied_by_user_id" bigint NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_cash_advance_application_source" CHECK (("cash_advance_application"."source_type" = 'expense_claim_line'
      and "cash_advance_application"."expense_claim_line_id" is not null and "cash_advance_application"."allowance_calculation_id" is null)
      or ("cash_advance_application"."source_type" = 'allowance'
        and "cash_advance_application"."expense_claim_line_id" is null and "cash_advance_application"."allowance_calculation_id" is not null)),
	CONSTRAINT "ck_cash_advance_application_amount" CHECK ("cash_advance_application"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "cash_advance_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_advance_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"advance_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_cash_advance_event_type" CHECK ("cash_advance_event"."event_type" in ('issued','closed')),
	CONSTRAINT "ck_cash_advance_event_reason" CHECK (char_length("cash_advance_event"."reason") between 3 and 1000)
);
--> statement-breakpoint
CREATE TABLE "cash_advance_posting" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_advance_posting_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"advance_id" bigint NOT NULL,
	"posting_type" text NOT NULL,
	"journal_ref" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"debit_account_id" bigint NOT NULL,
	"credit_account_id" bigint NOT NULL,
	"debit_gl_entry_id" bigint NOT NULL,
	"credit_gl_entry_id" bigint NOT NULL,
	"posted_by_user_id" bigint NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_cash_advance_posting_type" CHECK ("cash_advance_posting"."posting_type" in ('issue','expense_application','employee_repayment')),
	CONSTRAINT "ck_cash_advance_posting_amount" CHECK ("cash_advance_posting"."amount" > 0),
	CONSTRAINT "ck_cash_advance_posting_accounts" CHECK ("cash_advance_posting"."debit_account_id" <> "cash_advance_posting"."credit_account_id"
      and "cash_advance_posting"."debit_gl_entry_id" <> "cash_advance_posting"."credit_gl_entry_id")
);
--> statement-breakpoint
CREATE TABLE "expense_allowance_calculation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_allowance_calculation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"calculation_key" text NOT NULL,
	"owner_user_id" bigint NOT NULL,
	"employee_id" bigint NOT NULL,
	"policy_version_id" bigint NOT NULL,
	"allowance_type" text NOT NULL,
	"service_date" date NOT NULL,
	"unit" text NOT NULL,
	"units" numeric(18, 4) NOT NULL,
	"rate" numeric(18, 4) NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"currency" text NOT NULL,
	"receipt_required" boolean DEFAULT false NOT NULL,
	"calculation_evidence" jsonb NOT NULL,
	"status" text DEFAULT 'calculated' NOT NULL,
	"approved_by_user_id" bigint,
	"approved_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_allowance_calculation_type" CHECK (("expense_allowance_calculation"."allowance_type" = 'mileage' and "expense_allowance_calculation"."unit" = 'km')
      or ("expense_allowance_calculation"."allowance_type" = 'per_diem' and "expense_allowance_calculation"."unit" = 'day')),
	CONSTRAINT "ck_expense_allowance_calculation_amounts" CHECK ("expense_allowance_calculation"."units" > 0 and "expense_allowance_calculation"."rate" > 0 and "expense_allowance_calculation"."amount" > 0),
	CONSTRAINT "ck_expense_allowance_calculation_currency" CHECK ("expense_allowance_calculation"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_expense_allowance_no_receipt" CHECK ("expense_allowance_calculation"."receipt_required" = false),
	CONSTRAINT "ck_expense_allowance_calculation_status" CHECK ("expense_allowance_calculation"."status" in ('calculated','approved','applied')),
	CONSTRAINT "ck_expense_allowance_calculation_approval" CHECK (("expense_allowance_calculation"."status" = 'calculated'
      and "expense_allowance_calculation"."approved_by_user_id" is null and "expense_allowance_calculation"."approved_at" is null and "expense_allowance_calculation"."applied_at" is null)
      or ("expense_allowance_calculation"."status" = 'approved'
        and "expense_allowance_calculation"."approved_by_user_id" is not null and "expense_allowance_calculation"."approved_at" is not null
        and "expense_allowance_calculation"."applied_at" is null)
      or ("expense_allowance_calculation"."status" = 'applied'
        and "expense_allowance_calculation"."approved_by_user_id" is not null and "expense_allowance_calculation"."approved_at" is not null
        and "expense_allowance_calculation"."applied_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "expense_allowance_policy_version" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_allowance_policy_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"policy_key" text NOT NULL,
	"version_no" integer NOT NULL,
	"allowance_type" text NOT NULL,
	"unit" text NOT NULL,
	"rate" numeric(18, 4) NOT NULL,
	"currency" text NOT NULL,
	"maximum_units" numeric(18, 4),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"confirmed_by_user_id" bigint NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_allowance_policy_key" CHECK ("expense_allowance_policy_version"."policy_key" ~ '^[a-z][a-z0-9._-]{2,63}$'),
	CONSTRAINT "ck_expense_allowance_policy_type" CHECK (("expense_allowance_policy_version"."allowance_type" = 'mileage' and "expense_allowance_policy_version"."unit" = 'km')
      or ("expense_allowance_policy_version"."allowance_type" = 'per_diem' and "expense_allowance_policy_version"."unit" = 'day')),
	CONSTRAINT "ck_expense_allowance_policy_rate" CHECK ("expense_allowance_policy_version"."rate" > 0),
	CONSTRAINT "ck_expense_allowance_policy_currency" CHECK ("expense_allowance_policy_version"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_expense_allowance_policy_max" CHECK ("expense_allowance_policy_version"."maximum_units" is null or "expense_allowance_policy_version"."maximum_units" > 0),
	CONSTRAINT "ck_expense_allowance_policy_dates" CHECK ("expense_allowance_policy_version"."effective_to" is null or "expense_allowance_policy_version"."effective_to" >= "expense_allowance_policy_version"."effective_from"),
	CONSTRAINT "ck_expense_allowance_policy_status" CHECK ("expense_allowance_policy_version"."status" = 'confirmed'),
	CONSTRAINT "ck_expense_allowance_policy_version_no" CHECK ("expense_allowance_policy_version"."version_no" > 0)
);
--> statement-breakpoint
ALTER TABLE "cash_advance" ADD CONSTRAINT "cash_advance_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance" ADD CONSTRAINT "cash_advance_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance" ADD CONSTRAINT "cash_advance_advance_receivable_account_id_account_id_fk" FOREIGN KEY ("advance_receivable_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance" ADD CONSTRAINT "cash_advance_employee_payable_account_id_account_id_fk" FOREIGN KEY ("employee_payable_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance" ADD CONSTRAINT "cash_advance_bank_account_id_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance" ADD CONSTRAINT "cash_advance_closed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_application" ADD CONSTRAINT "cash_advance_application_advance_id_cash_advance_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."cash_advance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_application" ADD CONSTRAINT "cash_advance_application_expense_claim_line_id_expense_claim_line_id_fk" FOREIGN KEY ("expense_claim_line_id") REFERENCES "public"."expense_claim_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_application" ADD CONSTRAINT "cash_advance_application_allowance_calculation_id_expense_allowance_calculation_id_fk" FOREIGN KEY ("allowance_calculation_id") REFERENCES "public"."expense_allowance_calculation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_application" ADD CONSTRAINT "cash_advance_application_applied_by_user_id_app_user_user_id_fk" FOREIGN KEY ("applied_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_event" ADD CONSTRAINT "cash_advance_event_advance_id_cash_advance_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."cash_advance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_event" ADD CONSTRAINT "cash_advance_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_posting" ADD CONSTRAINT "cash_advance_posting_advance_id_cash_advance_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."cash_advance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_posting" ADD CONSTRAINT "cash_advance_posting_debit_account_id_account_id_fk" FOREIGN KEY ("debit_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_posting" ADD CONSTRAINT "cash_advance_posting_credit_account_id_account_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_posting" ADD CONSTRAINT "cash_advance_posting_debit_gl_entry_id_gl_entry_id_fk" FOREIGN KEY ("debit_gl_entry_id") REFERENCES "public"."gl_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_posting" ADD CONSTRAINT "cash_advance_posting_credit_gl_entry_id_gl_entry_id_fk" FOREIGN KEY ("credit_gl_entry_id") REFERENCES "public"."gl_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_advance_posting" ADD CONSTRAINT "cash_advance_posting_posted_by_user_id_app_user_user_id_fk" FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allowance_calculation" ADD CONSTRAINT "expense_allowance_calculation_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allowance_calculation" ADD CONSTRAINT "expense_allowance_calculation_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allowance_calculation" ADD CONSTRAINT "expense_allowance_calculation_policy_version_id_expense_allowance_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."expense_allowance_policy_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allowance_calculation" ADD CONSTRAINT "expense_allowance_calculation_approved_by_user_id_app_user_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allowance_policy_version" ADD CONSTRAINT "expense_allowance_policy_version_confirmed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cash_advance_key" ON "cash_advance" USING btree ("master_fn","company_fn","advance_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cash_advance_no" ON "cash_advance" USING btree ("master_fn","company_fn","advance_no");--> statement-breakpoint
CREATE INDEX "idx_cash_advance_employee" ON "cash_advance" USING btree ("master_fn","company_fn","employee_id","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cash_advance_application_claim_line" ON "cash_advance_application" USING btree ("master_fn","company_fn","expense_claim_line_id") WHERE "cash_advance_application"."expense_claim_line_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cash_advance_application_allowance" ON "cash_advance_application" USING btree ("master_fn","company_fn","allowance_calculation_id") WHERE "cash_advance_application"."allowance_calculation_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_cash_advance_application_advance" ON "cash_advance_application" USING btree ("master_fn","company_fn","advance_id","id");--> statement-breakpoint
CREATE INDEX "idx_cash_advance_event" ON "cash_advance_event" USING btree ("master_fn","company_fn","advance_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cash_advance_posting_type" ON "cash_advance_posting" USING btree ("master_fn","company_fn","advance_id","posting_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cash_advance_posting_ref" ON "cash_advance_posting" USING btree ("master_fn","company_fn","journal_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_allowance_calculation_key" ON "expense_allowance_calculation" USING btree ("master_fn","company_fn","calculation_key");--> statement-breakpoint
CREATE INDEX "idx_expense_allowance_calculation_owner" ON "expense_allowance_calculation" USING btree ("master_fn","company_fn","owner_user_id","status","service_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_allowance_policy_version" ON "expense_allowance_policy_version" USING btree ("master_fn","company_fn","policy_key","version_no");--> statement-breakpoint
CREATE INDEX "idx_expense_allowance_policy_effective" ON "expense_allowance_policy_version" USING btree ("master_fn","company_fn","allowance_type","status","effective_from","id");
--> statement-breakpoint
INSERT INTO "role_permission" ("master_fn", "role_id", "permission_key", "allowed")
SELECT "master_fn", "role_id", permission_key, true
FROM "role"
CROSS JOIN (
  VALUES ('expenses.allowance.manage'), ('expenses.advance.manage')
) AS permission(permission_key)
WHERE "name" IN ('Finance', 'Finance Manager')
ON CONFLICT ("role_id", "permission_key") DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_expense_settlement_fact_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_allowance_calculation_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.master_fn IS DISTINCT FROM NEW.master_fn
    OR OLD.company_fn IS DISTINCT FROM NEW.company_fn
    OR OLD.calculation_key IS DISTINCT FROM NEW.calculation_key
    OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id
    OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
    OR OLD.policy_version_id IS DISTINCT FROM NEW.policy_version_id
    OR OLD.allowance_type IS DISTINCT FROM NEW.allowance_type
    OR OLD.service_date IS DISTINCT FROM NEW.service_date
    OR OLD.unit IS DISTINCT FROM NEW.unit
    OR OLD.units IS DISTINCT FROM NEW.units
    OR OLD.rate IS DISTINCT FROM NEW.rate
    OR OLD.amount IS DISTINCT FROM NEW.amount
    OR OLD.currency IS DISTINCT FROM NEW.currency
    OR OLD.receipt_required IS DISTINCT FROM NEW.receipt_required
    OR OLD.calculation_evidence IS DISTINCT FROM NEW.calculation_evidence
    OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'allowance calculation source facts are immutable';
  END IF;
  IF NOT (
    (OLD.status = 'calculated' AND NEW.status = 'approved')
    OR (OLD.status = 'approved' AND NEW.status = 'applied')
  ) THEN
    RAISE EXCEPTION 'allowance calculation status transition is invalid';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_cash_advance_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.master_fn IS DISTINCT FROM NEW.master_fn
    OR OLD.company_fn IS DISTINCT FROM NEW.company_fn
    OR OLD.advance_key IS DISTINCT FROM NEW.advance_key
    OR OLD.advance_no IS DISTINCT FROM NEW.advance_no
    OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
    OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id
    OR OLD.currency IS DISTINCT FROM NEW.currency
    OR OLD.issued_amount IS DISTINCT FROM NEW.issued_amount
    OR OLD.issued_date IS DISTINCT FROM NEW.issued_date
    OR OLD.purpose IS DISTINCT FROM NEW.purpose
    OR OLD.advance_receivable_account_id IS DISTINCT FROM NEW.advance_receivable_account_id
    OR OLD.employee_payable_account_id IS DISTINCT FROM NEW.employee_payable_account_id
    OR OLD.bank_account_id IS DISTINCT FROM NEW.bank_account_id
    OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'cash advance issue facts are immutable';
  END IF;
  IF OLD.status <> 'issued' OR NEW.status <> 'closed' OR NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'cash advance status transition is invalid';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_allowance_policy_immutable
ON expense_allowance_policy_version;
--> statement-breakpoint
CREATE TRIGGER expense_allowance_policy_immutable
BEFORE UPDATE OR DELETE ON expense_allowance_policy_version
FOR EACH ROW EXECUTE FUNCTION prevent_expense_settlement_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_allowance_calculation_projection
ON expense_allowance_calculation;
--> statement-breakpoint
CREATE TRIGGER expense_allowance_calculation_projection
BEFORE UPDATE ON expense_allowance_calculation
FOR EACH ROW EXECUTE FUNCTION enforce_allowance_calculation_update();
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_allowance_calculation_no_delete
ON expense_allowance_calculation;
--> statement-breakpoint
CREATE TRIGGER expense_allowance_calculation_no_delete
BEFORE DELETE ON expense_allowance_calculation
FOR EACH ROW EXECUTE FUNCTION prevent_expense_settlement_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS cash_advance_projection
ON cash_advance;
--> statement-breakpoint
CREATE TRIGGER cash_advance_projection
BEFORE UPDATE ON cash_advance
FOR EACH ROW EXECUTE FUNCTION enforce_cash_advance_update();
--> statement-breakpoint
DROP TRIGGER IF EXISTS cash_advance_no_delete
ON cash_advance;
--> statement-breakpoint
CREATE TRIGGER cash_advance_no_delete
BEFORE DELETE ON cash_advance
FOR EACH ROW EXECUTE FUNCTION prevent_expense_settlement_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS cash_advance_application_immutable
ON cash_advance_application;
--> statement-breakpoint
CREATE TRIGGER cash_advance_application_immutable
BEFORE UPDATE OR DELETE ON cash_advance_application
FOR EACH ROW EXECUTE FUNCTION prevent_expense_settlement_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS cash_advance_posting_immutable
ON cash_advance_posting;
--> statement-breakpoint
CREATE TRIGGER cash_advance_posting_immutable
BEFORE UPDATE OR DELETE ON cash_advance_posting
FOR EACH ROW EXECUTE FUNCTION prevent_expense_settlement_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS cash_advance_event_append_only
ON cash_advance_event;
--> statement-breakpoint
CREATE TRIGGER cash_advance_event_append_only
BEFORE UPDATE OR DELETE ON cash_advance_event
FOR EACH ROW EXECUTE FUNCTION prevent_expense_settlement_fact_change();
