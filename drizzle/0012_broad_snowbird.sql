CREATE TABLE "sales_enquiry" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_enquiry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"customer_id" bigint NOT NULL,
	"subject" text NOT NULL,
	"channel" text DEFAULT 'direct' NOT NULL,
	"estimated_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" text NOT NULL,
	"owner_name" text NOT NULL,
	"enquiry_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_enquiry_status" CHECK ("sales_enquiry"."status" in ('new', 'quoted', 'lost')),
	CONSTRAINT "ck_sales_enquiry_value" CHECK ("sales_enquiry"."estimated_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_quotation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_quotation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"customer_id" bigint NOT NULL,
	"enquiry_id" bigint,
	"order_id" bigint,
	"quote_date" date NOT NULL,
	"valid_until" date NOT NULL,
	"currency" text NOT NULL,
	"probability" numeric(5, 2) DEFAULT '50' NOT NULL,
	"net_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_quotation_status" CHECK ("sales_quotation"."status" in ('draft', 'sent', 'accepted', 'converted', 'rejected', 'expired')),
	CONSTRAINT "ck_sales_quotation_probability" CHECK ("sales_quotation"."probability" >= 0 and "sales_quotation"."probability" <= 100),
	CONSTRAINT "ck_sales_quotation_dates" CHECK ("sales_quotation"."valid_until" >= "sales_quotation"."quote_date")
);
--> statement-breakpoint
CREATE TABLE "sales_quotation_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_quotation_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"quotation_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"unit_price" numeric(18, 4) NOT NULL,
	"net_amount" numeric(18, 2) NOT NULL,
	"tax_code" text NOT NULL,
	"tax_rate" numeric(6, 3) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_quotation_line_qty" CHECK ("sales_quotation_line"."qty" > 0 and "sales_quotation_line"."unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sales_enquiry" ADD CONSTRAINT "sales_enquiry_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_quotation" ADD CONSTRAINT "sales_quotation_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_quotation" ADD CONSTRAINT "sales_quotation_enquiry_id_sales_enquiry_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."sales_enquiry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_quotation" ADD CONSTRAINT "sales_quotation_order_id_sales_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_quotation_line" ADD CONSTRAINT "sales_quotation_line_quotation_id_sales_quotation_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."sales_quotation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_quotation_line" ADD CONSTRAINT "sales_quotation_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_enquiry_docno" ON "sales_enquiry" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_sales_enquiry_status" ON "sales_enquiry" USING btree ("master_fn","company_fn","status","enquiry_date","id");--> statement-breakpoint
CREATE INDEX "idx_sales_enquiry_customer" ON "sales_enquiry" USING btree ("master_fn","company_fn","customer_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_quotation_docno" ON "sales_quotation" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_quotation_enquiry" ON "sales_quotation" USING btree ("master_fn","company_fn","enquiry_id");--> statement-breakpoint
CREATE INDEX "idx_sales_quotation_status" ON "sales_quotation" USING btree ("master_fn","company_fn","status","quote_date","id");--> statement-breakpoint
CREATE INDEX "idx_sales_quotation_customer" ON "sales_quotation" USING btree ("master_fn","company_fn","customer_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_quotation_line" ON "sales_quotation_line" USING btree ("master_fn","company_fn","quotation_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_sales_quotation_line_product" ON "sales_quotation_line" USING btree ("master_fn","company_fn","product_id","quotation_id");