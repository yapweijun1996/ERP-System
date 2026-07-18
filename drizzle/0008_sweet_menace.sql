CREATE TABLE "stock_reservation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_reservation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"pick_id" bigint NOT NULL,
	"pick_line_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"warehouse_id" bigint NOT NULL,
	"bin_id" bigint NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_stock_reservation_qty" CHECK ("stock_reservation"."qty" > 0),
	CONSTRAINT "ck_stock_reservation_status" CHECK ("stock_reservation"."status" in ('active', 'consumed', 'released'))
);
--> statement-breakpoint
CREATE TABLE "warehouse_pick" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "warehouse_pick_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"warehouse_id" bigint NOT NULL,
	"sales_order_id" bigint,
	"priority" text DEFAULT 'normal' NOT NULL,
	"assignee" text,
	"pick_date" date NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_warehouse_pick_status" CHECK ("warehouse_pick"."status" in ('open', 'in_progress', 'picked', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "warehouse_pick_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "warehouse_pick_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"pick_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint NOT NULL,
	"bin_id" bigint NOT NULL,
	"required_qty" numeric(18, 4) NOT NULL,
	"picked_qty" numeric(18, 4) DEFAULT '0' NOT NULL,
	"uom" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_warehouse_pick_line_qty" CHECK ("warehouse_pick_line"."required_qty" > 0 and "warehouse_pick_line"."picked_qty" >= 0 and "warehouse_pick_line"."picked_qty" <= "warehouse_pick_line"."required_qty")
);
--> statement-breakpoint
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_pick_id_warehouse_pick_id_fk" FOREIGN KEY ("pick_id") REFERENCES "public"."warehouse_pick"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_pick_line_id_warehouse_pick_line_id_fk" FOREIGN KEY ("pick_line_id") REFERENCES "public"."warehouse_pick_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_bin_id_warehouse_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "public"."warehouse_bin"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pick" ADD CONSTRAINT "warehouse_pick_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pick_line" ADD CONSTRAINT "warehouse_pick_line_pick_id_warehouse_pick_id_fk" FOREIGN KEY ("pick_id") REFERENCES "public"."warehouse_pick"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pick_line" ADD CONSTRAINT "warehouse_pick_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_pick_line" ADD CONSTRAINT "warehouse_pick_line_bin_id_warehouse_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "public"."warehouse_bin"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_stock_reservation_pick_line" ON "stock_reservation" USING btree ("master_fn","company_fn","pick_line_id");--> statement-breakpoint
CREATE INDEX "idx_stock_reservation_active" ON "stock_reservation" USING btree ("master_fn","company_fn","product_id","warehouse_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_warehouse_pick_docno" ON "warehouse_pick" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_warehouse_pick_status" ON "warehouse_pick" USING btree ("master_fn","company_fn","status","pick_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_warehouse_pick_line" ON "warehouse_pick_line" USING btree ("master_fn","company_fn","pick_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_warehouse_pick_line_product" ON "warehouse_pick_line" USING btree ("master_fn","company_fn","product_id","pick_id");