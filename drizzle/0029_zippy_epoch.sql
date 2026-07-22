CREATE TABLE "purchase_rfq" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_rfq_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"requisition_id" bigint,
	"subject" text NOT NULL,
	"rfq_date" date NOT NULL,
	"response_due_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_purchase_rfq_status" CHECK ("purchase_rfq"."status" in ('draft', 'sent', 'responded', 'awarded', 'closed')),
	CONSTRAINT "ck_purchase_rfq_dates" CHECK ("purchase_rfq"."response_due_date" >= "purchase_rfq"."rfq_date")
);
--> statement-breakpoint
CREATE TABLE "purchase_rfq_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_rfq_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"rfq_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_purchase_rfq_line_qty" CHECK ("purchase_rfq_line"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_rfq_supplier" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_rfq_supplier_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"rfq_id" bigint NOT NULL,
	"supplier_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_quotation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_quotation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"rfq_id" bigint NOT NULL,
	"supplier_id" bigint NOT NULL,
	"quote_date" date NOT NULL,
	"valid_until" date NOT NULL,
	"currency" text NOT NULL,
	"lead_time_days" integer NOT NULL,
	"payment_terms" text NOT NULL,
	"warranty" text,
	"status" text DEFAULT 'received' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"net_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_supplier_quotation_status" CHECK ("supplier_quotation"."status" in ('received', 'converted', 'rejected')),
	CONSTRAINT "ck_supplier_quotation_dates" CHECK ("supplier_quotation"."valid_until" >= "supplier_quotation"."quote_date"),
	CONSTRAINT "ck_supplier_quotation_lead" CHECK ("supplier_quotation"."lead_time_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "supplier_quotation_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_quotation_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"quotation_id" bigint NOT NULL,
	"rfq_line_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"unit_cost" numeric(18, 4) NOT NULL,
	"net_amount" numeric(18, 2) NOT NULL,
	"tax_code" text NOT NULL,
	"tax_rate" numeric(6, 3) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_supplier_quotation_line_values" CHECK ("supplier_quotation_line"."qty" > 0 and "supplier_quotation_line"."unit_cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "purchase_order" ADD COLUMN "supplier_quotation_id" bigint;--> statement-breakpoint
ALTER TABLE "purchase_rfq" ADD CONSTRAINT "purchase_rfq_requisition_id_purchase_requisition_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."purchase_requisition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfq_line" ADD CONSTRAINT "purchase_rfq_line_rfq_id_purchase_rfq_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."purchase_rfq"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfq_line" ADD CONSTRAINT "purchase_rfq_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfq_supplier" ADD CONSTRAINT "purchase_rfq_supplier_rfq_id_purchase_rfq_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."purchase_rfq"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_rfq_supplier" ADD CONSTRAINT "purchase_rfq_supplier_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotation" ADD CONSTRAINT "supplier_quotation_rfq_id_purchase_rfq_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."purchase_rfq"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotation" ADD CONSTRAINT "supplier_quotation_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotation_line" ADD CONSTRAINT "supplier_quotation_line_quotation_id_supplier_quotation_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."supplier_quotation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotation_line" ADD CONSTRAINT "supplier_quotation_line_rfq_line_id_purchase_rfq_line_id_fk" FOREIGN KEY ("rfq_line_id") REFERENCES "public"."purchase_rfq_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotation_line" ADD CONSTRAINT "supplier_quotation_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_rfq_docno" ON "purchase_rfq" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_rfq_requisition" ON "purchase_rfq" USING btree ("master_fn","company_fn","requisition_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_rfq_status" ON "purchase_rfq" USING btree ("master_fn","company_fn","status","rfq_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_rfq_line" ON "purchase_rfq_line" USING btree ("master_fn","company_fn","rfq_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_purchase_rfq_line_product" ON "purchase_rfq_line" USING btree ("master_fn","company_fn","product_id","rfq_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_rfq_supplier" ON "purchase_rfq_supplier" USING btree ("master_fn","company_fn","rfq_id","supplier_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_rfq_supplier_supplier" ON "purchase_rfq_supplier" USING btree ("master_fn","company_fn","supplier_id","rfq_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supplier_quotation_docno" ON "supplier_quotation" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supplier_quotation_rfq_supplier" ON "supplier_quotation" USING btree ("master_fn","company_fn","rfq_id","supplier_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_quotation_status" ON "supplier_quotation" USING btree ("master_fn","company_fn","status","quote_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supplier_quotation_line" ON "supplier_quotation_line" USING btree ("master_fn","company_fn","quotation_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supplier_quotation_rfq_line" ON "supplier_quotation_line" USING btree ("master_fn","company_fn","quotation_id","rfq_line_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_quotation_line_product" ON "supplier_quotation_line" USING btree ("master_fn","company_fn","product_id","quotation_id");--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_quotation_id_supplier_quotation_id_fk" FOREIGN KEY ("supplier_quotation_id") REFERENCES "public"."supplier_quotation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_po_supplier_quotation" ON "purchase_order" USING btree ("master_fn","company_fn","supplier_quotation_id");