CREATE TABLE "supplier_price_list" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_price_list_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"supplier_id" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"lead_time_days" integer DEFAULT 0 NOT NULL,
	"payment_terms" text,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_supplier_price_list_status" CHECK ("supplier_price_list"."status" in ('draft', 'active', 'archived')),
	CONSTRAINT "ck_supplier_price_list_lead" CHECK ("supplier_price_list"."lead_time_days" >= 0),
	CONSTRAINT "ck_supplier_price_list_dates" CHECK ("supplier_price_list"."effective_to" is null or "supplier_price_list"."effective_to" >= "supplier_price_list"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "supplier_price_list_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_price_list_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"price_list_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint NOT NULL,
	"min_qty" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_cost" numeric(18, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_supplier_price_list_line_values" CHECK ("supplier_price_list_line"."min_qty" > 0 and "supplier_price_list_line"."unit_cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "supplier_price_list" ADD CONSTRAINT "supplier_price_list_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_price_list_line" ADD CONSTRAINT "supplier_price_list_line_price_list_id_supplier_price_list_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."supplier_price_list"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_price_list_line" ADD CONSTRAINT "supplier_price_list_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supplier_price_list_code" ON "supplier_price_list" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE INDEX "idx_supplier_price_list_supplier" ON "supplier_price_list" USING btree ("master_fn","company_fn","supplier_id","status","effective_from","id");--> statement-breakpoint
CREATE INDEX "idx_supplier_price_list_status" ON "supplier_price_list" USING btree ("master_fn","company_fn","status","effective_from","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supplier_price_list_line" ON "supplier_price_list_line" USING btree ("master_fn","company_fn","price_list_id","product_id","min_qty");--> statement-breakpoint
CREATE INDEX "idx_supplier_price_list_line_product" ON "supplier_price_list_line" USING btree ("master_fn","company_fn","product_id","price_list_id");