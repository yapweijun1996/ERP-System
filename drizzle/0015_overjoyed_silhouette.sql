CREATE TABLE "sales_debit_note" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_debit_note_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"invoice_id" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"note_date" date NOT NULL,
	"currency" text NOT NULL,
	"reason" text NOT NULL,
	"net_amount" numeric(18, 2) NOT NULL,
	"tax_code" text NOT NULL,
	"tax_rate" numeric(6, 3) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_debit_note_status" CHECK ("sales_debit_note"."status" in ('draft', 'posted', 'cancelled')),
	CONSTRAINT "ck_sales_debit_note_amount" CHECK ("sales_debit_note"."net_amount" > 0 and "sales_debit_note"."tax_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sales_debit_note" ADD CONSTRAINT "sales_debit_note_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_debit_note_docno" ON "sales_debit_note" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_sales_debit_note_invoice" ON "sales_debit_note" USING btree ("master_fn","company_fn","invoice_id","id");--> statement-breakpoint
CREATE INDEX "idx_sales_debit_note_status" ON "sales_debit_note" USING btree ("master_fn","company_fn","status","note_date","id");