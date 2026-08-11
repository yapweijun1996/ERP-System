CREATE TABLE "company_receipt" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "company_receipt_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"receipt_key" text NOT NULL,
	"document_id" bigint NOT NULL,
	"document_version_id" bigint NOT NULL,
	"uploader_user_id" bigint NOT NULL,
	"transaction_date" date,
	"merchant" text NOT NULL,
	"receipt_number" text,
	"amount" numeric(18, 4) NOT NULL,
	"currency_code" text NOT NULL,
	"category" text NOT NULL,
	"business_purpose" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_company_receipt_key" CHECK ("company_receipt"."receipt_key" ~ '^company-receipt:[0-9a-f-]{36}$'),
	CONSTRAINT "ck_company_receipt_merchant" CHECK (char_length("company_receipt"."merchant") between 1 and 200),
	CONSTRAINT "ck_company_receipt_number" CHECK ("company_receipt"."receipt_number" is null or char_length("company_receipt"."receipt_number") between 1 and 120),
	CONSTRAINT "ck_company_receipt_amount" CHECK ("company_receipt"."amount" > 0),
	CONSTRAINT "ck_company_receipt_currency" CHECK ("company_receipt"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_company_receipt_category" CHECK (char_length("company_receipt"."category") between 1 and 120),
	CONSTRAINT "ck_company_receipt_business_purpose" CHECK (char_length("company_receipt"."business_purpose") between 1 and 500),
	CONSTRAINT "ck_company_receipt_notes" CHECK ("company_receipt"."notes" is null or char_length("company_receipt"."notes") between 1 and 2000),
	CONSTRAINT "ck_company_receipt_status" CHECK ("company_receipt"."status" in ('draft','processing','ready','needs_attention','voided')),
	CONSTRAINT "ck_company_receipt_version" CHECK ("company_receipt"."version" > 0),
	CONSTRAINT "ck_company_receipt_void" CHECK (("company_receipt"."status" = 'voided'
      and char_length("company_receipt"."void_reason") between 3 and 1000
      and "company_receipt"."voided_at" is not null
      and "company_receipt"."voided_by_user_id" is not null)
      or ("company_receipt"."status" <> 'voided'
        and "company_receipt"."void_reason" is null
        and "company_receipt"."voided_at" is null
        and "company_receipt"."voided_by_user_id" is null))
);
--> statement-breakpoint
ALTER TABLE "company_receipt" ADD CONSTRAINT "company_receipt_document_id_managed_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."managed_document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_receipt" ADD CONSTRAINT "company_receipt_document_version_id_document_version_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_receipt" ADD CONSTRAINT "company_receipt_uploader_user_id_app_user_user_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_receipt" ADD CONSTRAINT "company_receipt_currency_code_currency_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_receipt" ADD CONSTRAINT "company_receipt_voided_by_user_id_app_user_user_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_receipt_key" ON "company_receipt" USING btree ("master_fn","company_fn","receipt_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_receipt_document" ON "company_receipt" USING btree ("master_fn","company_fn","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_receipt_document_version" ON "company_receipt" USING btree ("master_fn","company_fn","document_version_id");--> statement-breakpoint
CREATE INDEX "idx_company_receipt_uploader" ON "company_receipt" USING btree ("master_fn","company_fn","uploader_user_id","status","id");--> statement-breakpoint
CREATE INDEX "idx_company_receipt_transaction_date" ON "company_receipt" USING btree ("master_fn","company_fn","transaction_date","id");