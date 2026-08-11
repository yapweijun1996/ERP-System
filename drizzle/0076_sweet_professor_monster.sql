CREATE TABLE "sales_enquiry_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_enquiry_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"enquiry_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"estimated_unit_price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_enquiry_line_values" CHECK ("sales_enquiry_line"."qty" > 0 and "sales_enquiry_line"."estimated_unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sales_enquiry_line" ADD CONSTRAINT "sales_enquiry_line_enquiry_id_sales_enquiry_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."sales_enquiry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_enquiry_line" ADD CONSTRAINT "sales_enquiry_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_enquiry_line" ON "sales_enquiry_line" USING btree ("master_fn","company_fn","enquiry_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_sales_enquiry_line_product" ON "sales_enquiry_line" USING btree ("master_fn","company_fn","product_id","enquiry_id");