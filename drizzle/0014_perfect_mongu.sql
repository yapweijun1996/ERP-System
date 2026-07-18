CREATE TABLE "sales_credit_note" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_credit_note_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"return_id" bigint NOT NULL,
	"invoice_id" bigint NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"note_date" date NOT NULL,
	"currency" text NOT NULL,
	"net_amount" numeric(18, 2) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_credit_note_status" CHECK ("sales_credit_note"."status" in ('posted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "sales_credit_note_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_credit_note_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
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
CREATE TABLE "sales_return" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_return_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"delivery_id" bigint NOT NULL,
	"invoice_id" bigint NOT NULL,
	"warehouse_id" bigint NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"return_date" date NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_return_status" CHECK ("sales_return"."status" in ('requested', 'credited', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "sales_return_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_return_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"return_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"delivery_line_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"unit_price" numeric(18, 4) NOT NULL,
	"net_amount" numeric(18, 2) NOT NULL,
	"tax_code" text NOT NULL,
	"tax_rate" numeric(6, 3) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_return_line_qty" CHECK ("sales_return_line"."qty" > 0 and "sales_return_line"."unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sales_credit_note" ADD CONSTRAINT "sales_credit_note_return_id_sales_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."sales_return"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_credit_note" ADD CONSTRAINT "sales_credit_note_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_credit_note_line" ADD CONSTRAINT "sales_credit_note_line_credit_note_id_sales_credit_note_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."sales_credit_note"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_credit_note_line" ADD CONSTRAINT "sales_credit_note_line_return_line_id_sales_return_line_id_fk" FOREIGN KEY ("return_line_id") REFERENCES "public"."sales_return_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_credit_note_line" ADD CONSTRAINT "sales_credit_note_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return" ADD CONSTRAINT "sales_return_delivery_id_sales_delivery_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."sales_delivery"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return" ADD CONSTRAINT "sales_return_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return" ADD CONSTRAINT "sales_return_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_line" ADD CONSTRAINT "sales_return_line_return_id_sales_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."sales_return"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_line" ADD CONSTRAINT "sales_return_line_delivery_line_id_sales_delivery_line_id_fk" FOREIGN KEY ("delivery_line_id") REFERENCES "public"."sales_delivery_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_line" ADD CONSTRAINT "sales_return_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_credit_note_docno" ON "sales_credit_note" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_credit_note_return" ON "sales_credit_note" USING btree ("master_fn","company_fn","return_id");--> statement-breakpoint
CREATE INDEX "idx_sales_credit_note_invoice" ON "sales_credit_note" USING btree ("master_fn","company_fn","invoice_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_credit_note_line" ON "sales_credit_note_line" USING btree ("master_fn","company_fn","credit_note_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_return_docno" ON "sales_return" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_sales_return_status" ON "sales_return" USING btree ("master_fn","company_fn","status","return_date","id");--> statement-breakpoint
CREATE INDEX "idx_sales_return_delivery" ON "sales_return" USING btree ("master_fn","company_fn","delivery_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_return_line" ON "sales_return_line" USING btree ("master_fn","company_fn","return_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_sales_return_line_delivery" ON "sales_return_line" USING btree ("master_fn","company_fn","delivery_line_id","id");