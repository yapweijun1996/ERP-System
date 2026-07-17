-- ============================================================
-- Browser-demo compatibility migrations (PGlite / IndexedDB)
--
-- Fresh databases are created from erp-system-schema.sql. This file upgrades
-- databases that were persisted by an older build before later Drizzle
-- migrations existed. Every statement is idempotent because it may be replayed
-- after an interrupted browser boot.
-- ============================================================

-- 0001_quiet_blizzard
-- Legacy demo users predate password auth. Backfill them with the public demo
-- password hash (demo1234) before restoring the current NOT NULL invariant.
ALTER TABLE "app_user" ADD COLUMN IF NOT EXISTS "password_hash" text;
UPDATE "app_user"
SET "password_hash" = 'pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48'
WHERE "password_hash" IS NULL;
ALTER TABLE "app_user" ALTER COLUMN "password_hash" SET NOT NULL;

-- 0002_messy_slyde (Purchasing)
CREATE TABLE IF NOT EXISTS "goods_receipt" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "goods_receipt_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"order_id" bigint NOT NULL,
	"warehouse_id" bigint NOT NULL,
	"received_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "purchase_order" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_order_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"supplier_id" bigint NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"order_date" date NOT NULL,
	"currency" text NOT NULL,
	"net_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "purchase_order_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_order_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"order_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"unit_cost" numeric(18, 4) NOT NULL,
	"net_amount" numeric(18, 2) NOT NULL,
	"tax_code" text NOT NULL,
	"tax_rate" numeric(6, 3) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "supplier" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "supplier_invoice" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_invoice_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"order_id" bigint NOT NULL,
	"supplier_id" bigint NOT NULL,
	"status" text DEFAULT 'unpaid' NOT NULL,
	"invoice_date" date NOT NULL,
	"currency" text NOT NULL,
	"net_amount" numeric(18, 2) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_order_id_purchase_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_order_id_purchase_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "supplier_invoice" ADD CONSTRAINT "supplier_invoice_order_id_purchase_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "supplier_invoice" ADD CONSTRAINT "supplier_invoice_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_gr_docno" ON "goods_receipt" USING btree ("master_fn","company_fn","doc_no");
CREATE INDEX IF NOT EXISTS "idx_gr_order" ON "goods_receipt" USING btree ("master_fn","company_fn","order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_po_docno" ON "purchase_order" USING btree ("master_fn","company_fn","doc_no");
CREATE INDEX IF NOT EXISTS "idx_po_tenant_date" ON "purchase_order" USING btree ("master_fn","company_fn","order_date","id");
CREATE INDEX IF NOT EXISTS "idx_pol_order" ON "purchase_order_line" USING btree ("master_fn","company_fn","order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_supplier_code" ON "supplier" USING btree ("master_fn","company_fn","code");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_si_docno" ON "supplier_invoice" USING btree ("master_fn","company_fn","doc_no");
CREATE INDEX IF NOT EXISTS "idx_si_order" ON "supplier_invoice" USING btree ("master_fn","company_fn","order_id");

-- 0003_fuzzy_ronan (CRM)
CREATE TABLE IF NOT EXISTS "activity" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"opportunity_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "opportunity" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "opportunity_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"customer_id" bigint NOT NULL,
	"title" text NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"currency" text NOT NULL,
	"stage" text DEFAULT 'lead' NOT NULL,
	"probability" numeric(5, 2) DEFAULT '0' NOT NULL,
	"close_date" date NOT NULL,
	"owner_user_id" bigint,
	"order_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "activity" ADD CONSTRAINT "activity_opportunity_id_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunity"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_order_id_sales_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "idx_activity_opportunity" ON "activity" USING btree ("master_fn","company_fn","opportunity_id","occurred_at");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_opp_docno" ON "opportunity" USING btree ("master_fn","company_fn","doc_no");
CREATE INDEX IF NOT EXISTS "idx_opp_tenant_stage" ON "opportunity" USING btree ("master_fn","company_fn","stage","id");
CREATE INDEX IF NOT EXISTS "idx_opp_customer" ON "opportunity" USING btree ("master_fn","company_fn","customer_id");
