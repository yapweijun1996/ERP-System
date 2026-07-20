CREATE TABLE "bank_receipt" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_receipt_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"progress_claim_id" bigint NOT NULL,
	"received_date" date NOT NULL,
	"bank_ref" text,
	"amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_bank_receipt_amount" CHECK ("bank_receipt"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_voucher" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_voucher_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"supplier_id" bigint NOT NULL,
	"payment_date" date NOT NULL,
	"bank_ref" text,
	"total_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_voucher_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_voucher_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"payment_voucher_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"supplier_invoice_id" bigint NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_order" ADD COLUMN "project_id" bigint;--> statement-breakpoint
ALTER TABLE "supplier_invoice" ADD COLUMN "project_id" bigint;--> statement-breakpoint
ALTER TABLE "bank_receipt" ADD CONSTRAINT "bank_receipt_progress_claim_id_progress_claim_id_fk" FOREIGN KEY ("progress_claim_id") REFERENCES "public"."progress_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_voucher" ADD CONSTRAINT "payment_voucher_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_voucher_line" ADD CONSTRAINT "payment_voucher_line_payment_voucher_id_payment_voucher_id_fk" FOREIGN KEY ("payment_voucher_id") REFERENCES "public"."payment_voucher"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_voucher_line" ADD CONSTRAINT "payment_voucher_line_supplier_invoice_id_supplier_invoice_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bank_receipt_docno" ON "bank_receipt" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_bank_receipt_claim" ON "bank_receipt" USING btree ("master_fn","company_fn","progress_claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_voucher_docno" ON "payment_voucher" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_payment_voucher_supplier" ON "payment_voucher" USING btree ("master_fn","company_fn","supplier_id");--> statement-breakpoint
CREATE INDEX "idx_pvl_voucher" ON "payment_voucher_line" USING btree ("master_fn","company_fn","payment_voucher_id");--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice" ADD CONSTRAINT "supplier_invoice_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_po_project" ON "purchase_order" USING btree ("master_fn","company_fn","project_id");--> statement-breakpoint
CREATE INDEX "idx_si_project" ON "supplier_invoice" USING btree ("master_fn","company_fn","project_id");