-- Effective-dated expense tax/FX/GL policy and immutable submission evidence.
CREATE TABLE "expense_bank_charge_override" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_bank_charge_override_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"snapshot_id" bigint NOT NULL,
	"actual_base_gross" numeric(18, 4) NOT NULL,
	"actual_fx_rate" numeric(18, 8) NOT NULL,
	"evidence_version_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"verified_by_user_id" bigint NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_bank_charge_override_amounts" CHECK ("expense_bank_charge_override"."actual_base_gross" > 0 and "expense_bank_charge_override"."actual_fx_rate" > 0),
	CONSTRAINT "ck_expense_bank_charge_override_reason" CHECK (char_length("expense_bank_charge_override"."reason") between 3 and 1000)
);
--> statement-breakpoint
CREATE TABLE "expense_category" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_category_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_category_code" CHECK ("expense_category"."code" ~ '^[A-Z][A-Z0-9_-]{1,31}$'),
	CONSTRAINT "ck_expense_category_name" CHECK (char_length("expense_category"."name") between 2 and 120)
);
--> statement-breakpoint
CREATE TABLE "expense_line_policy_snapshot" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_line_policy_snapshot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"line_key" text NOT NULL,
	"owner_user_id" bigint NOT NULL,
	"category_id" bigint NOT NULL,
	"policy_version_id" bigint NOT NULL,
	"transaction_date" date NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_source" text NOT NULL,
	"original_currency" text NOT NULL,
	"original_net" numeric(18, 4) NOT NULL,
	"original_tax" numeric(18, 4) NOT NULL,
	"original_gross" numeric(18, 4) NOT NULL,
	"functional_currency" text NOT NULL,
	"policy_fx_rate" numeric(18, 8) NOT NULL,
	"base_expense" numeric(18, 4) NOT NULL,
	"base_input_tax" numeric(18, 4) NOT NULL,
	"base_gross" numeric(18, 4) NOT NULL,
	"tax_treatment" text NOT NULL,
	"tax_code" text,
	"tax_rate" numeric(7, 4) NOT NULL,
	"input_tax_recoverable_pct" numeric(7, 4) NOT NULL,
	"expense_account_id" bigint NOT NULL,
	"input_tax_account_id" bigint,
	"credit_account_id" bigint NOT NULL,
	"fx_method" text NOT NULL,
	CONSTRAINT "ck_expense_line_policy_snapshot_key" CHECK ("expense_line_policy_snapshot"."line_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_expense_line_policy_snapshot_payment" CHECK ("expense_line_policy_snapshot"."payment_source" in ('employee_paid','company_paid')),
	CONSTRAINT "ck_expense_line_policy_snapshot_amounts" CHECK ("expense_line_policy_snapshot"."original_net" >= 0 and "expense_line_policy_snapshot"."original_tax" >= 0 and "expense_line_policy_snapshot"."original_gross" > 0
      and "expense_line_policy_snapshot"."original_net" + "expense_line_policy_snapshot"."original_tax" = "expense_line_policy_snapshot"."original_gross"
      and "expense_line_policy_snapshot"."policy_fx_rate" > 0
      and "expense_line_policy_snapshot"."base_expense" >= 0 and "expense_line_policy_snapshot"."base_input_tax" >= 0 and "expense_line_policy_snapshot"."base_gross" > 0
      and "expense_line_policy_snapshot"."base_expense" + "expense_line_policy_snapshot"."base_input_tax" = "expense_line_policy_snapshot"."base_gross"),
	CONSTRAINT "ck_expense_line_policy_snapshot_tax" CHECK ("expense_line_policy_snapshot"."tax_treatment" in ('input_tax','non_deductible','exempt')
      and "expense_line_policy_snapshot"."tax_rate" >= 0
      and "expense_line_policy_snapshot"."input_tax_recoverable_pct" between 0.0000 and 100.0000),
	CONSTRAINT "ck_expense_line_policy_snapshot_fx" CHECK ("expense_line_policy_snapshot"."fx_method" in ('table_rate','actual_bank_allowed'))
);
--> statement-breakpoint
CREATE TABLE "expense_policy" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_policy_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"policy_key" text NOT NULL,
	"name" text NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_policy_key" CHECK ("expense_policy"."policy_key" ~ '^[a-z][a-z0-9._-]{2,63}$'),
	CONSTRAINT "ck_expense_policy_name" CHECK (char_length("expense_policy"."name") between 3 and 160)
);
--> statement-breakpoint
CREATE TABLE "expense_policy_version" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_policy_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"policy_id" bigint NOT NULL,
	"category_id" bigint NOT NULL,
	"version_no" integer NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"evidence_required" boolean DEFAULT true NOT NULL,
	"max_gross_base" numeric(18, 4),
	"tax_treatment" text NOT NULL,
	"tax_code" text,
	"input_tax_recoverable_pct" numeric(7, 4) DEFAULT '0' NOT NULL,
	"employee_paid_allowed" boolean DEFAULT true NOT NULL,
	"company_paid_allowed" boolean DEFAULT false NOT NULL,
	"expense_account_id" bigint NOT NULL,
	"input_tax_account_id" bigint,
	"employee_payable_account_id" bigint NOT NULL,
	"company_paid_clearing_account_id" bigint NOT NULL,
	"fx_method" text DEFAULT 'table_rate' NOT NULL,
	"confirmed_by_user_id" bigint NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_policy_version_no" CHECK ("expense_policy_version"."version_no" > 0),
	CONSTRAINT "ck_expense_policy_dates" CHECK ("expense_policy_version"."valid_to" is null or "expense_policy_version"."valid_to" >= "expense_policy_version"."valid_from"),
	CONSTRAINT "ck_expense_policy_status" CHECK ("expense_policy_version"."status" = 'confirmed'),
	CONSTRAINT "ck_expense_policy_limit" CHECK ("expense_policy_version"."max_gross_base" is null or "expense_policy_version"."max_gross_base" > 0),
	CONSTRAINT "ck_expense_policy_tax_treatment" CHECK ("expense_policy_version"."tax_treatment" in ('input_tax','non_deductible','exempt')),
	CONSTRAINT "ck_expense_policy_tax_config" CHECK (("expense_policy_version"."tax_treatment" = 'input_tax'
      and char_length("expense_policy_version"."tax_code") between 1 and 20
      and "expense_policy_version"."input_tax_account_id" is not null
      and "expense_policy_version"."input_tax_recoverable_pct" between 0.0000 and 100.0000)
      or ("expense_policy_version"."tax_treatment" in ('non_deductible','exempt')
        and "expense_policy_version"."tax_code" is null
        and "expense_policy_version"."input_tax_account_id" is null
        and "expense_policy_version"."input_tax_recoverable_pct" = 0)),
	CONSTRAINT "ck_expense_policy_payment_source" CHECK ("expense_policy_version"."employee_paid_allowed" or "expense_policy_version"."company_paid_allowed"),
	CONSTRAINT "ck_expense_policy_fx_method" CHECK ("expense_policy_version"."fx_method" in ('table_rate','actual_bank_allowed'))
);
--> statement-breakpoint
ALTER TABLE "expense_bank_charge_override" ADD CONSTRAINT "expense_bank_charge_override_snapshot_id_expense_line_policy_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."expense_line_policy_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_bank_charge_override" ADD CONSTRAINT "expense_bank_charge_override_evidence_version_id_document_version_id_fk" FOREIGN KEY ("evidence_version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_bank_charge_override" ADD CONSTRAINT "expense_bank_charge_override_verified_by_user_id_app_user_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_policy_snapshot" ADD CONSTRAINT "expense_line_policy_snapshot_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_policy_snapshot" ADD CONSTRAINT "expense_line_policy_snapshot_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_policy_snapshot" ADD CONSTRAINT "expense_line_policy_snapshot_policy_version_id_expense_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."expense_policy_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_policy_snapshot" ADD CONSTRAINT "expense_line_policy_snapshot_original_currency_currency_code_fk" FOREIGN KEY ("original_currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_policy_snapshot" ADD CONSTRAINT "expense_line_policy_snapshot_functional_currency_currency_code_fk" FOREIGN KEY ("functional_currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_policy_snapshot" ADD CONSTRAINT "expense_line_policy_snapshot_expense_account_id_account_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_policy_snapshot" ADD CONSTRAINT "expense_line_policy_snapshot_input_tax_account_id_account_id_fk" FOREIGN KEY ("input_tax_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_policy_snapshot" ADD CONSTRAINT "expense_line_policy_snapshot_credit_account_id_account_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_policy" ADD CONSTRAINT "expense_policy_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_policy_version" ADD CONSTRAINT "expense_policy_version_policy_id_expense_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."expense_policy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_policy_version" ADD CONSTRAINT "expense_policy_version_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_policy_version" ADD CONSTRAINT "expense_policy_version_expense_account_id_account_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_policy_version" ADD CONSTRAINT "expense_policy_version_input_tax_account_id_account_id_fk" FOREIGN KEY ("input_tax_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_policy_version" ADD CONSTRAINT "expense_policy_version_employee_payable_account_id_account_id_fk" FOREIGN KEY ("employee_payable_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_policy_version" ADD CONSTRAINT "expense_policy_version_company_paid_clearing_account_id_account_id_fk" FOREIGN KEY ("company_paid_clearing_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_policy_version" ADD CONSTRAINT "expense_policy_version_confirmed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_bank_charge_override_snapshot" ON "expense_bank_charge_override" USING btree ("master_fn","company_fn","snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_expense_bank_charge_override_actor" ON "expense_bank_charge_override" USING btree ("master_fn","company_fn","verified_by_user_id","verified_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_category_code" ON "expense_category" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_line_policy_snapshot_key" ON "expense_line_policy_snapshot" USING btree ("master_fn","company_fn","line_key");--> statement-breakpoint
CREATE INDEX "idx_expense_line_policy_snapshot_owner" ON "expense_line_policy_snapshot" USING btree ("master_fn","company_fn","owner_user_id","submitted_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_policy_key" ON "expense_policy" USING btree ("master_fn","company_fn","policy_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_policy_version" ON "expense_policy_version" USING btree ("master_fn","company_fn","policy_id","version_no");--> statement-breakpoint
CREATE INDEX "idx_expense_policy_effective" ON "expense_policy_version" USING btree ("master_fn","company_fn","category_id","status","valid_from","valid_to");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_expense_policy_fact_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_policy_version_immutable ON expense_policy_version;
--> statement-breakpoint
CREATE TRIGGER expense_policy_version_immutable
BEFORE UPDATE OR DELETE ON expense_policy_version
FOR EACH ROW EXECUTE FUNCTION prevent_expense_policy_fact_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_line_policy_snapshot_immutable ON expense_line_policy_snapshot;
--> statement-breakpoint
CREATE TRIGGER expense_line_policy_snapshot_immutable
BEFORE UPDATE OR DELETE ON expense_line_policy_snapshot
FOR EACH ROW EXECUTE FUNCTION prevent_expense_policy_fact_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_bank_charge_override_immutable ON expense_bank_charge_override;
--> statement-breakpoint
CREATE TRIGGER expense_bank_charge_override_immutable
BEFORE UPDATE OR DELETE ON expense_bank_charge_override
FOR EACH ROW EXECUTE FUNCTION prevent_expense_policy_fact_mutation();
