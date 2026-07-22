CREATE TABLE "bank_statement" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_statement_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"statement_no" text NOT NULL,
	"bank_account_id" bigint NOT NULL,
	"currency" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"opening_balance" numeric(18, 2) NOT NULL,
	"closing_balance" numeric(18, 2) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_bank_statement_status" CHECK ("bank_statement"."status" in ('draft', 'reconciled')),
	CONSTRAINT "ck_bank_statement_period" CHECK ("bank_statement"."period_end" >= "bank_statement"."period_start"),
	CONSTRAINT "ck_bank_statement_currency" CHECK (char_length("bank_statement"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "bank_statement_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_statement_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"statement_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"transaction_date" date NOT NULL,
	"reference" text,
	"description" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"matched_gl_entry_id" bigint,
	"matched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_bank_statement_line_amount" CHECK ("bank_statement_line"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "bank_statement" ADD CONSTRAINT "bank_statement_bank_account_id_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_line" ADD CONSTRAINT "bank_statement_line_statement_id_bank_statement_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."bank_statement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_line" ADD CONSTRAINT "bank_statement_line_matched_gl_entry_id_gl_entry_id_fk" FOREIGN KEY ("matched_gl_entry_id") REFERENCES "public"."gl_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bank_statement_number" ON "bank_statement" USING btree ("master_fn","company_fn","statement_no");--> statement-breakpoint
CREATE INDEX "idx_bank_statement_status" ON "bank_statement" USING btree ("master_fn","company_fn","status","period_end","id");--> statement-breakpoint
CREATE INDEX "idx_bank_statement_account" ON "bank_statement" USING btree ("master_fn","company_fn","bank_account_id","period_end","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bank_statement_line_number" ON "bank_statement_line" USING btree ("master_fn","company_fn","statement_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bank_statement_line_gl" ON "bank_statement_line" USING btree ("master_fn","company_fn","matched_gl_entry_id");--> statement-breakpoint
CREATE INDEX "idx_bank_statement_line_statement" ON "bank_statement_line" USING btree ("master_fn","company_fn","statement_id","id");--> statement-breakpoint
CREATE INDEX "idx_bank_statement_line_unmatched" ON "bank_statement_line" USING btree ("master_fn","company_fn","matched_gl_entry_id","id");