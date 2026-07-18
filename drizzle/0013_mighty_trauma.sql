CREATE TABLE "sales_delivery" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_delivery_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"order_id" bigint NOT NULL,
	"invoice_id" bigint,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"delivery_date" date NOT NULL,
	"carrier" text,
	"tracking_no" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_delivery_status" CHECK ("sales_delivery"."status" in ('draft', 'delivered', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "sales_delivery_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_delivery_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"delivery_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"order_line_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"warehouse_id" bigint NOT NULL,
	"delivered_qty" numeric(18, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_delivery_line_qty" CHECK ("sales_delivery_line"."delivered_qty" > 0)
);
--> statement-breakpoint
ALTER TABLE "sales_delivery" ADD CONSTRAINT "sales_delivery_order_id_sales_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery" ADD CONSTRAINT "sales_delivery_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_line" ADD CONSTRAINT "sales_delivery_line_delivery_id_sales_delivery_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."sales_delivery"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_line" ADD CONSTRAINT "sales_delivery_line_order_line_id_sales_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."sales_order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_line" ADD CONSTRAINT "sales_delivery_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_line" ADD CONSTRAINT "sales_delivery_line_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_delivery_docno" ON "sales_delivery" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_delivery_order" ON "sales_delivery" USING btree ("master_fn","company_fn","order_id");--> statement-breakpoint
CREATE INDEX "idx_sales_delivery_status" ON "sales_delivery" USING btree ("master_fn","company_fn","status","delivery_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_delivery_line" ON "sales_delivery_line" USING btree ("master_fn","company_fn","delivery_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_sales_delivery_line_order" ON "sales_delivery_line" USING btree ("master_fn","company_fn","order_line_id","id");