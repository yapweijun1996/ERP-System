CREATE TABLE "sales_discount_rule" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_discount_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"rule_type" text NOT NULL,
	"customer_id" bigint,
	"product_id" bigint,
	"min_qty" numeric(18, 4),
	"min_order_amount" numeric(18, 2),
	"discount_pct" numeric(6, 3) NOT NULL,
	"approval_threshold_pct" numeric(6, 3),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_discount_rule_type" CHECK ("sales_discount_rule"."rule_type" in ('standard', 'customer', 'product', 'quantity', 'campaign')),
	CONSTRAINT "ck_sales_discount_rule_status" CHECK ("sales_discount_rule"."status" in ('draft', 'active', 'inactive')),
	CONSTRAINT "ck_sales_discount_rule_pct" CHECK ("sales_discount_rule"."discount_pct" >= 0 and "sales_discount_rule"."discount_pct" <= 100
      and ("sales_discount_rule"."approval_threshold_pct" is null
        or ("sales_discount_rule"."approval_threshold_pct" >= 0 and "sales_discount_rule"."approval_threshold_pct" <= 100))),
	CONSTRAINT "ck_sales_discount_rule_dates" CHECK ("sales_discount_rule"."effective_to" is null or "sales_discount_rule"."effective_to" >= "sales_discount_rule"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "sales_price_list" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_price_list_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"basis" text DEFAULT 'standard' NOT NULL,
	"customer_id" bigint,
	"currency" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_price_list_basis" CHECK ("sales_price_list"."basis" in ('standard', 'customer', 'promotion')),
	CONSTRAINT "ck_sales_price_list_status" CHECK ("sales_price_list"."status" in ('draft', 'active', 'archived')),
	CONSTRAINT "ck_sales_price_list_dates" CHECK ("sales_price_list"."effective_to" is null or "sales_price_list"."effective_to" >= "sales_price_list"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "sales_price_list_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_price_list_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"price_list_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint NOT NULL,
	"min_qty" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 4) NOT NULL,
	"floor_price" numeric(18, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_price_list_line_amounts" CHECK ("sales_price_list_line"."min_qty" > 0 and "sales_price_list_line"."unit_price" >= 0 and "sales_price_list_line"."floor_price" >= 0),
	CONSTRAINT "ck_sales_price_list_floor" CHECK ("sales_price_list_line"."unit_price" >= "sales_price_list_line"."floor_price")
);
--> statement-breakpoint
ALTER TABLE "sales_discount_rule" ADD CONSTRAINT "sales_discount_rule_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_discount_rule" ADD CONSTRAINT "sales_discount_rule_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_price_list" ADD CONSTRAINT "sales_price_list_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_price_list_line" ADD CONSTRAINT "sales_price_list_line_price_list_id_sales_price_list_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."sales_price_list"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_price_list_line" ADD CONSTRAINT "sales_price_list_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_discount_rule_code" ON "sales_discount_rule" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE INDEX "idx_sales_discount_rule_status" ON "sales_discount_rule" USING btree ("master_fn","company_fn","status","effective_from","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_price_list_code" ON "sales_price_list" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE INDEX "idx_sales_price_list_status" ON "sales_price_list" USING btree ("master_fn","company_fn","status","effective_from","id");--> statement-breakpoint
CREATE INDEX "idx_sales_price_list_customer" ON "sales_price_list" USING btree ("master_fn","company_fn","customer_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_price_list_line" ON "sales_price_list_line" USING btree ("master_fn","company_fn","price_list_id","product_id","min_qty");--> statement-breakpoint
CREATE INDEX "idx_sales_price_list_line_product" ON "sales_price_list_line" USING btree ("master_fn","company_fn","product_id","price_list_id");