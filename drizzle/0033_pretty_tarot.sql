CREATE TABLE "landed_cost" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "landed_cost_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"goods_receipt_id" bigint NOT NULL,
	"order_id" bigint NOT NULL,
	"supplier_id" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"cost_date" date NOT NULL,
	"currency" text NOT NULL,
	"allocation_basis" text NOT NULL,
	"goods_value" numeric(18, 2) NOT NULL,
	"freight_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"duty_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"handling_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"other_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_added_cost" numeric(18, 2) NOT NULL,
	"allocated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_landed_cost_status" CHECK ("landed_cost"."status" in ('draft', 'allocated', 'cancelled')),
	CONSTRAINT "ck_landed_cost_basis" CHECK ("landed_cost"."allocation_basis" in ('value', 'quantity')),
	CONSTRAINT "ck_landed_cost_values" CHECK (
    "landed_cost"."goods_value" > 0 and "landed_cost"."freight_amount" >= 0 and "landed_cost"."duty_amount" >= 0
    and "landed_cost"."handling_amount" >= 0 and "landed_cost"."other_amount" >= 0 and "landed_cost"."total_added_cost" > 0
  )
);
--> statement-breakpoint
CREATE TABLE "landed_cost_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "landed_cost_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"landed_cost_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"purchase_order_line_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"received_qty" numeric(18, 4) NOT NULL,
	"goods_value" numeric(18, 2) NOT NULL,
	"allocated_amount" numeric(18, 2) NOT NULL,
	"on_hand_qty_at_allocation" numeric(18, 4),
	"average_cost_before" numeric(22, 8),
	"average_cost_after" numeric(22, 8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_landed_cost_line_values" CHECK (
    "landed_cost_line"."received_qty" > 0 and "landed_cost_line"."goods_value" >= 0 and "landed_cost_line"."allocated_amount" >= 0
  )
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "average_cost" numeric(22, 8);--> statement-breakpoint
ALTER TABLE "landed_cost" ADD CONSTRAINT "landed_cost_goods_receipt_id_goods_receipt_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost" ADD CONSTRAINT "landed_cost_order_id_purchase_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost" ADD CONSTRAINT "landed_cost_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_line" ADD CONSTRAINT "landed_cost_line_landed_cost_id_landed_cost_id_fk" FOREIGN KEY ("landed_cost_id") REFERENCES "public"."landed_cost"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_line" ADD CONSTRAINT "landed_cost_line_purchase_order_line_id_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_line" ADD CONSTRAINT "landed_cost_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_landed_cost_docno" ON "landed_cost" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_landed_cost_receipt" ON "landed_cost" USING btree ("master_fn","company_fn","goods_receipt_id","id");--> statement-breakpoint
CREATE INDEX "idx_landed_cost_status" ON "landed_cost" USING btree ("master_fn","company_fn","status","cost_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_landed_cost_line_no" ON "landed_cost_line" USING btree ("master_fn","company_fn","landed_cost_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_landed_cost_source_line" ON "landed_cost_line" USING btree ("master_fn","company_fn","landed_cost_id","purchase_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_landed_cost_line_product" ON "landed_cost_line" USING btree ("master_fn","company_fn","product_id","landed_cost_id");--> statement-breakpoint
-- Existing tenants run migrations rather than seed/setup. Add the accrual account
-- only when the tenant has not already configured code 2300.
INSERT INTO "account" ("master_fn", "company_fn", "code", "name", "type")
SELECT "master_fn", "company_fn", '2300', 'Landed Cost Accrual', 'liability'
FROM "company"
ON CONFLICT ("master_fn", "company_fn", "code") DO NOTHING;
