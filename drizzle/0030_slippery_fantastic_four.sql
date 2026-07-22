CREATE TABLE "purchase_return" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_return_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"goods_receipt_id" bigint NOT NULL,
	"supplier_invoice_id" bigint NOT NULL,
	"warehouse_id" bigint NOT NULL,
	"return_date" date NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"net_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_purchase_return_status" CHECK ("purchase_return"."status" in ('requested', 'credited', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "purchase_return_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_return_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"return_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"purchase_order_line_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"unit_cost" numeric(18, 4) NOT NULL,
	"net_amount" numeric(18, 2) NOT NULL,
	"tax_code" text NOT NULL,
	"tax_rate" numeric(6, 3) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_purchase_return_line_values" CHECK ("purchase_return_line"."qty" > 0 and "purchase_return_line"."unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "supplier_credit_note" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_credit_note_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"return_id" bigint NOT NULL,
	"supplier_invoice_id" bigint NOT NULL,
	"supplier_id" bigint NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"note_date" date NOT NULL,
	"currency" text NOT NULL,
	"net_amount" numeric(18, 2) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_supplier_credit_note_status" CHECK ("supplier_credit_note"."status" = 'posted')
);
--> statement-breakpoint
CREATE TABLE "supplier_credit_note_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_credit_note_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"credit_note_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"return_line_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"net_amount" numeric(18, 2) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_return" ADD CONSTRAINT "purchase_return_goods_receipt_id_goods_receipt_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return" ADD CONSTRAINT "purchase_return_supplier_invoice_id_supplier_invoice_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return" ADD CONSTRAINT "purchase_return_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_line" ADD CONSTRAINT "purchase_return_line_return_id_purchase_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."purchase_return"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_line" ADD CONSTRAINT "purchase_return_line_purchase_order_line_id_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_line" ADD CONSTRAINT "purchase_return_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_note" ADD CONSTRAINT "supplier_credit_note_return_id_purchase_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."purchase_return"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_note" ADD CONSTRAINT "supplier_credit_note_supplier_invoice_id_supplier_invoice_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_note" ADD CONSTRAINT "supplier_credit_note_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_note_line" ADD CONSTRAINT "supplier_credit_note_line_credit_note_id_supplier_credit_note_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."supplier_credit_note"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_note_line" ADD CONSTRAINT "supplier_credit_note_line_return_line_id_purchase_return_line_id_fk" FOREIGN KEY ("return_line_id") REFERENCES "public"."purchase_return_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_note_line" ADD CONSTRAINT "supplier_credit_note_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_return_docno" ON "purchase_return" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_purchase_return_invoice" ON "purchase_return" USING btree ("master_fn","company_fn","supplier_invoice_id","id");--> statement-breakpoint
CREATE INDEX "idx_purchase_return_status" ON "purchase_return" USING btree ("master_fn","company_fn","status","return_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_return_line_no" ON "purchase_return_line" USING btree ("master_fn","company_fn","return_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_return_source_line" ON "purchase_return_line" USING btree ("master_fn","company_fn","return_id","purchase_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_return_line_product" ON "purchase_return_line" USING btree ("master_fn","company_fn","product_id","return_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supplier_credit_note_docno" ON "supplier_credit_note" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supplier_credit_note_return" ON "supplier_credit_note" USING btree ("master_fn","company_fn","return_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_credit_note_invoice" ON "supplier_credit_note" USING btree ("master_fn","company_fn","supplier_invoice_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supplier_credit_note_line" ON "supplier_credit_note_line" USING btree ("master_fn","company_fn","credit_note_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supplier_credit_note_return_line" ON "supplier_credit_note_line" USING btree ("master_fn","company_fn","return_line_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_credit_note_line_product" ON "supplier_credit_note_line" USING btree ("master_fn","company_fn","product_id","credit_note_id");