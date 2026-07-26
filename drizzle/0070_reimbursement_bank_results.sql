CREATE TABLE "reimbursement_bank_export" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reimbursement_bank_export_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"export_key" text NOT NULL,
	"batch_id" bigint NOT NULL,
	"template_version_id" bigint NOT NULL,
	"export_version" integer NOT NULL,
	"retry_of_export_id" bigint,
	"artifact_file_name" text NOT NULL,
	"artifact_envelope" jsonb NOT NULL,
	"content_sha256" text NOT NULL,
	"row_count" integer NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"generated_by_user_id" bigint NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reimbursement_bank_export_key" CHECK ("reimbursement_bank_export"."export_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_reimbursement_bank_export_version" CHECK ("reimbursement_bank_export"."export_version" > 0),
	CONSTRAINT "ck_reimbursement_bank_export_file" CHECK (char_length("reimbursement_bank_export"."artifact_file_name") between 5 and 180
      and "reimbursement_bank_export"."artifact_file_name" ~ '\.csv$'),
	CONSTRAINT "ck_reimbursement_bank_export_hash" CHECK (char_length("reimbursement_bank_export"."content_sha256") = 64
      and "reimbursement_bank_export"."content_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_reimbursement_bank_export_totals" CHECK ("reimbursement_bank_export"."row_count" > 0 and "reimbursement_bank_export"."total_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "reimbursement_bank_export_access_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reimbursement_bank_export_access_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"export_id" bigint NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"access_key" text NOT NULL,
	"action" text NOT NULL,
	"purpose" text NOT NULL,
	"content_sha256" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reimbursement_bank_export_access_key" CHECK ("reimbursement_bank_export_access_event"."access_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_reimbursement_bank_export_access_action" CHECK ("reimbursement_bank_export_access_event"."action" in ('generated','downloaded')),
	CONSTRAINT "ck_reimbursement_bank_export_access_purpose" CHECK (char_length("reimbursement_bank_export_access_event"."purpose") between 3 and 500),
	CONSTRAINT "ck_reimbursement_bank_export_access_hash" CHECK (char_length("reimbursement_bank_export_access_event"."content_sha256") = 64
        and "reimbursement_bank_export_access_event"."content_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "reimbursement_bank_export_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reimbursement_bank_export_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"export_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"batch_line_id" bigint NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reimbursement_bank_export_line_no" CHECK ("reimbursement_bank_export_line"."line_no" > 0),
	CONSTRAINT "ck_reimbursement_bank_export_line_currency" CHECK ("reimbursement_bank_export_line"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_reimbursement_bank_export_line_amount" CHECK ("reimbursement_bank_export_line"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "reimbursement_bank_line_result" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reimbursement_bank_line_result_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"result_import_id" bigint NOT NULL,
	"export_line_id" bigint NOT NULL,
	"outcome" text NOT NULL,
	"bank_line_reference" text NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reimbursement_bank_line_result_outcome" CHECK ("reimbursement_bank_line_result"."outcome" in ('success','failed')),
	CONSTRAINT "ck_reimbursement_bank_line_result_reference" CHECK (char_length("reimbursement_bank_line_result"."bank_line_reference") between 1 and 160),
	CONSTRAINT "ck_reimbursement_bank_line_result_failure" CHECK (("reimbursement_bank_line_result"."outcome" = 'success'
      and "reimbursement_bank_line_result"."failure_code" is null and "reimbursement_bank_line_result"."failure_message" is null)
    or ("reimbursement_bank_line_result"."outcome" = 'failed'
      and char_length("reimbursement_bank_line_result"."failure_code") between 1 and 80
      and char_length("reimbursement_bank_line_result"."failure_message") between 3 and 500))
);
--> statement-breakpoint
CREATE TABLE "reimbursement_bank_result_import" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reimbursement_bank_result_import_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"import_key" text NOT NULL,
	"export_id" bigint NOT NULL,
	"bank_reference" text NOT NULL,
	"payment_date" date NOT NULL,
	"source_sha256" text NOT NULL,
	"row_count" integer NOT NULL,
	"imported_by_user_id" bigint NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reimbursement_bank_result_import_key" CHECK ("reimbursement_bank_result_import"."import_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_reimbursement_bank_result_import_reference" CHECK (char_length("reimbursement_bank_result_import"."bank_reference") between 3 and 160),
	CONSTRAINT "ck_reimbursement_bank_result_import_hash" CHECK (char_length("reimbursement_bank_result_import"."source_sha256") = 64
      and "reimbursement_bank_result_import"."source_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_reimbursement_bank_result_import_rows" CHECK ("reimbursement_bank_result_import"."row_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "reimbursement_bank_template_version" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reimbursement_bank_template_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"template_key" text NOT NULL,
	"version_no" integer NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"name" text NOT NULL,
	"bank_code" text NOT NULL,
	"file_format" text DEFAULT 'csv' NOT NULL,
	"delimiter" text DEFAULT ',' NOT NULL,
	"include_header" boolean DEFAULT true NOT NULL,
	"field_order" jsonb NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"confirmed_by_user_id" bigint NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reimbursement_bank_template_key" CHECK ("reimbursement_bank_template_version"."template_key" ~ '^[a-z][a-z0-9._-]{2,63}$'),
	CONSTRAINT "ck_reimbursement_bank_template_version_no" CHECK ("reimbursement_bank_template_version"."version_no" > 0),
	CONSTRAINT "ck_reimbursement_bank_template_dates" CHECK ("reimbursement_bank_template_version"."valid_to" is null or "reimbursement_bank_template_version"."valid_to" >= "reimbursement_bank_template_version"."valid_from"),
	CONSTRAINT "ck_reimbursement_bank_template_name" CHECK (char_length("reimbursement_bank_template_version"."name") between 3 and 160),
	CONSTRAINT "ck_reimbursement_bank_template_bank" CHECK (char_length("reimbursement_bank_template_version"."bank_code") between 2 and 20),
	CONSTRAINT "ck_reimbursement_bank_template_format" CHECK ("reimbursement_bank_template_version"."file_format" = 'csv' and "reimbursement_bank_template_version"."delimiter" in (',', chr(9), chr(59))),
	CONSTRAINT "ck_reimbursement_bank_template_status" CHECK ("reimbursement_bank_template_version"."status" = 'confirmed')
);
--> statement-breakpoint
CREATE TABLE "reimbursement_settlement" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reimbursement_settlement_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"batch_line_id" bigint NOT NULL,
	"result_line_id" bigint NOT NULL,
	"result_import_id" bigint NOT NULL,
	"accounting_period_id" bigint NOT NULL,
	"bank_reference" text NOT NULL,
	"payment_date" date NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"payable_account_id" bigint NOT NULL,
	"bank_account_id" bigint NOT NULL,
	"journal_ref" text NOT NULL,
	"debit_gl_entry_id" bigint NOT NULL,
	"credit_gl_entry_id" bigint NOT NULL,
	"facts_sha256" text NOT NULL,
	"posted_by_user_id" bigint NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_reimbursement_settlement_reference" CHECK (char_length("reimbursement_settlement"."bank_reference") between 3 and 160),
	CONSTRAINT "ck_reimbursement_settlement_currency" CHECK ("reimbursement_settlement"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_reimbursement_settlement_amount" CHECK ("reimbursement_settlement"."amount" > 0),
	CONSTRAINT "ck_reimbursement_settlement_accounts" CHECK ("reimbursement_settlement"."payable_account_id" <> "reimbursement_settlement"."bank_account_id"
      and "reimbursement_settlement"."debit_gl_entry_id" <> "reimbursement_settlement"."credit_gl_entry_id"),
	CONSTRAINT "ck_reimbursement_settlement_hash" CHECK (char_length("reimbursement_settlement"."facts_sha256") = 64
      and "reimbursement_settlement"."facts_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "reimbursement_bank_export" ADD CONSTRAINT "reimbursement_bank_export_batch_id_reimbursement_payment_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."reimbursement_payment_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_export" ADD CONSTRAINT "reimbursement_bank_export_template_version_id_reimbursement_bank_template_version_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."reimbursement_bank_template_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_export" ADD CONSTRAINT "reimbursement_bank_export_generated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_export_access_event" ADD CONSTRAINT "reimbursement_bank_export_access_event_export_id_reimbursement_bank_export_id_fk" FOREIGN KEY ("export_id") REFERENCES "public"."reimbursement_bank_export"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_export_access_event" ADD CONSTRAINT "reimbursement_bank_export_access_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_export_line" ADD CONSTRAINT "reimbursement_bank_export_line_export_id_reimbursement_bank_export_id_fk" FOREIGN KEY ("export_id") REFERENCES "public"."reimbursement_bank_export"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_export_line" ADD CONSTRAINT "reimbursement_bank_export_line_batch_line_id_reimbursement_payment_batch_line_id_fk" FOREIGN KEY ("batch_line_id") REFERENCES "public"."reimbursement_payment_batch_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_export_line" ADD CONSTRAINT "reimbursement_bank_export_line_currency_currency_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_line_result" ADD CONSTRAINT "reimbursement_bank_line_result_result_import_id_reimbursement_bank_result_import_id_fk" FOREIGN KEY ("result_import_id") REFERENCES "public"."reimbursement_bank_result_import"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_line_result" ADD CONSTRAINT "reimbursement_bank_line_result_export_line_id_reimbursement_bank_export_line_id_fk" FOREIGN KEY ("export_line_id") REFERENCES "public"."reimbursement_bank_export_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_result_import" ADD CONSTRAINT "reimbursement_bank_result_import_export_id_reimbursement_bank_export_id_fk" FOREIGN KEY ("export_id") REFERENCES "public"."reimbursement_bank_export"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_result_import" ADD CONSTRAINT "reimbursement_bank_result_import_imported_by_user_id_app_user_user_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_bank_template_version" ADD CONSTRAINT "reimbursement_bank_template_version_confirmed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_settlement" ADD CONSTRAINT "reimbursement_settlement_batch_line_id_reimbursement_payment_batch_line_id_fk" FOREIGN KEY ("batch_line_id") REFERENCES "public"."reimbursement_payment_batch_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_settlement" ADD CONSTRAINT "reimbursement_settlement_result_line_id_reimbursement_bank_line_result_id_fk" FOREIGN KEY ("result_line_id") REFERENCES "public"."reimbursement_bank_line_result"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_settlement" ADD CONSTRAINT "reimbursement_settlement_result_import_id_reimbursement_bank_result_import_id_fk" FOREIGN KEY ("result_import_id") REFERENCES "public"."reimbursement_bank_result_import"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_settlement" ADD CONSTRAINT "reimbursement_settlement_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_settlement" ADD CONSTRAINT "reimbursement_settlement_currency_currency_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_settlement" ADD CONSTRAINT "reimbursement_settlement_payable_account_id_account_id_fk" FOREIGN KEY ("payable_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_settlement" ADD CONSTRAINT "reimbursement_settlement_bank_account_id_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_settlement" ADD CONSTRAINT "reimbursement_settlement_debit_gl_entry_id_gl_entry_id_fk" FOREIGN KEY ("debit_gl_entry_id") REFERENCES "public"."gl_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_settlement" ADD CONSTRAINT "reimbursement_settlement_credit_gl_entry_id_gl_entry_id_fk" FOREIGN KEY ("credit_gl_entry_id") REFERENCES "public"."gl_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_settlement" ADD CONSTRAINT "reimbursement_settlement_posted_by_user_id_app_user_user_id_fk" FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_bank_export_key" ON "reimbursement_bank_export" USING btree ("master_fn","company_fn","export_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_bank_export_version" ON "reimbursement_bank_export" USING btree ("master_fn","company_fn","batch_id","export_version");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_bank_export_batch" ON "reimbursement_bank_export" USING btree ("master_fn","company_fn","batch_id","generated_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_bank_export_access_key" ON "reimbursement_bank_export_access_event" USING btree ("master_fn","company_fn","export_id","actor_user_id","access_key");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_bank_export_access" ON "reimbursement_bank_export_access_event" USING btree ("master_fn","company_fn","export_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_bank_export_line_no" ON "reimbursement_bank_export_line" USING btree ("master_fn","company_fn","export_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_bank_export_batch_line" ON "reimbursement_bank_export_line" USING btree ("master_fn","company_fn","export_id","batch_line_id");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_bank_export_line_batch" ON "reimbursement_bank_export_line" USING btree ("master_fn","company_fn","batch_line_id","export_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_bank_line_result_export_line" ON "reimbursement_bank_line_result" USING btree ("master_fn","company_fn","export_line_id");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_bank_line_result_import" ON "reimbursement_bank_line_result" USING btree ("master_fn","company_fn","result_import_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_bank_result_import_key" ON "reimbursement_bank_result_import" USING btree ("master_fn","company_fn","import_key");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_bank_result_import_export" ON "reimbursement_bank_result_import" USING btree ("master_fn","company_fn","export_id","imported_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_bank_template_version" ON "reimbursement_bank_template_version" USING btree ("master_fn","company_fn","template_key","version_no");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_bank_template_effective" ON "reimbursement_bank_template_version" USING btree ("master_fn","company_fn","template_key","status","valid_from","valid_to","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_settlement_batch_line" ON "reimbursement_settlement" USING btree ("master_fn","company_fn","batch_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_settlement_result_line" ON "reimbursement_settlement" USING btree ("master_fn","company_fn","result_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reimbursement_settlement_journal" ON "reimbursement_settlement" USING btree ("master_fn","company_fn","journal_ref");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_settlement_date" ON "reimbursement_settlement" USING btree ("master_fn","company_fn","payment_date","id");
--> statement-breakpoint
ALTER TABLE "reimbursement_bank_export" ADD CONSTRAINT "fk_reimbursement_bank_export_retry" FOREIGN KEY (retry_of_export_id) REFERENCES reimbursement_bank_export(id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_reimbursement_bank_fact_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_linked_reimbursement_gl_change()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM reimbursement_settlement
    WHERE debit_gl_entry_id = OLD.id OR credit_gl_entry_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'linked reimbursement GL entry is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS reimbursement_bank_template_immutable
ON reimbursement_bank_template_version;
--> statement-breakpoint
CREATE TRIGGER reimbursement_bank_template_immutable
BEFORE UPDATE OR DELETE ON reimbursement_bank_template_version
FOR EACH ROW EXECUTE FUNCTION prevent_reimbursement_bank_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS reimbursement_bank_export_immutable
ON reimbursement_bank_export;
--> statement-breakpoint
CREATE TRIGGER reimbursement_bank_export_immutable
BEFORE UPDATE OR DELETE ON reimbursement_bank_export
FOR EACH ROW EXECUTE FUNCTION prevent_reimbursement_bank_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS reimbursement_bank_export_line_immutable
ON reimbursement_bank_export_line;
--> statement-breakpoint
CREATE TRIGGER reimbursement_bank_export_line_immutable
BEFORE UPDATE OR DELETE ON reimbursement_bank_export_line
FOR EACH ROW EXECUTE FUNCTION prevent_reimbursement_bank_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS reimbursement_bank_export_access_immutable
ON reimbursement_bank_export_access_event;
--> statement-breakpoint
CREATE TRIGGER reimbursement_bank_export_access_immutable
BEFORE UPDATE OR DELETE ON reimbursement_bank_export_access_event
FOR EACH ROW EXECUTE FUNCTION prevent_reimbursement_bank_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS reimbursement_bank_result_import_immutable
ON reimbursement_bank_result_import;
--> statement-breakpoint
CREATE TRIGGER reimbursement_bank_result_import_immutable
BEFORE UPDATE OR DELETE ON reimbursement_bank_result_import
FOR EACH ROW EXECUTE FUNCTION prevent_reimbursement_bank_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS reimbursement_bank_line_result_immutable
ON reimbursement_bank_line_result;
--> statement-breakpoint
CREATE TRIGGER reimbursement_bank_line_result_immutable
BEFORE UPDATE OR DELETE ON reimbursement_bank_line_result
FOR EACH ROW EXECUTE FUNCTION prevent_reimbursement_bank_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS reimbursement_settlement_immutable
ON reimbursement_settlement;
--> statement-breakpoint
CREATE TRIGGER reimbursement_settlement_immutable
BEFORE UPDATE OR DELETE ON reimbursement_settlement
FOR EACH ROW EXECUTE FUNCTION prevent_reimbursement_bank_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS linked_reimbursement_gl_immutable
ON gl_entry;
--> statement-breakpoint
CREATE TRIGGER linked_reimbursement_gl_immutable
BEFORE UPDATE OR DELETE ON gl_entry
FOR EACH ROW EXECUTE FUNCTION prevent_linked_reimbursement_gl_change();
