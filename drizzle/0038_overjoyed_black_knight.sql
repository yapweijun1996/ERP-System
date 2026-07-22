CREATE TABLE "journal_header" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "journal_header_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"posting_date" date NOT NULL,
	"journal_type" text DEFAULT 'standard' NOT NULL,
	"memo" text NOT NULL,
	"reference" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"reversal_of_id" bigint,
	"posted_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_journal_header_type" CHECK ("journal_header"."journal_type" in ('standard', 'accrual', 'reclassification', 'reversal')),
	CONSTRAINT "ck_journal_header_status" CHECK ("journal_header"."status" in ('draft', 'posted', 'reversed'))
);
--> statement-breakpoint
CREATE TABLE "journal_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "journal_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"journal_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"account_id" bigint NOT NULL,
	"dimension" text,
	"debit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_journal_line_side" CHECK ((
    ("journal_line"."debit" > 0 and "journal_line"."credit" = 0)
    or ("journal_line"."credit" > 0 and "journal_line"."debit" = 0)
  ))
);
--> statement-breakpoint
ALTER TABLE "journal_header" ADD CONSTRAINT "fk_journal_header_reversal" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."journal_header"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_journal_id_journal_header_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journal_header"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_journal_header_docno" ON "journal_header" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_journal_header_reversal" ON "journal_header" USING btree ("master_fn","company_fn","reversal_of_id");--> statement-breakpoint
CREATE INDEX "idx_journal_header_status" ON "journal_header" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_journal_line_number" ON "journal_line" USING btree ("master_fn","company_fn","journal_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_journal_line_journal" ON "journal_line" USING btree ("master_fn","company_fn","journal_id","id");