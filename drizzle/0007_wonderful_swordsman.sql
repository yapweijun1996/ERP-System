CREATE TABLE "inventory_lot" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_lot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"product_id" bigint NOT NULL,
	"lot_no" text NOT NULL,
	"manufactured_date" date,
	"expiry_date" date,
	"quality_status" text DEFAULT 'released' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_inventory_lot_quality" CHECK ("inventory_lot"."quality_status" in ('released', 'hold', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "inventory_serial" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_serial_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"product_id" bigint NOT NULL,
	"serial_no" text NOT NULL,
	"lot_id" bigint,
	"status" text DEFAULT 'registered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_inventory_serial_status" CHECK ("inventory_serial"."status" in ('registered', 'available', 'issued', 'scrapped'))
);
--> statement-breakpoint
CREATE TABLE "stock_location_balance" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_location_balance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"product_id" bigint NOT NULL,
	"warehouse_id" bigint NOT NULL,
	"bin_id" bigint NOT NULL,
	"tracking_key" text DEFAULT 'none' NOT NULL,
	"lot_id" bigint,
	"serial_id" bigint,
	"qty" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_stock_location_nonnegative" CHECK ("stock_location_balance"."qty" >= 0),
	CONSTRAINT "ck_stock_location_tracking" CHECK (
    ("stock_location_balance"."tracking_key" = 'none' and "stock_location_balance"."lot_id" is null and "stock_location_balance"."serial_id" is null)
    or ("stock_location_balance"."tracking_key" like 'lot:%' and "stock_location_balance"."lot_id" is not null and "stock_location_balance"."serial_id" is null)
    or ("stock_location_balance"."tracking_key" like 'serial:%' and "stock_location_balance"."serial_id" is not null)
  ),
	CONSTRAINT "ck_stock_location_serial_qty" CHECK ("stock_location_balance"."serial_id" is null or "stock_location_balance"."qty" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE "warehouse_bin" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "warehouse_bin_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"warehouse_id" bigint NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movement" ADD COLUMN "bin_id" bigint;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD COLUMN "lot_id" bigint;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD COLUMN "serial_id" bigint;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD COLUMN "movement_group" text;--> statement-breakpoint
ALTER TABLE "inventory_lot" ADD CONSTRAINT "inventory_lot_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_serial" ADD CONSTRAINT "inventory_serial_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_serial" ADD CONSTRAINT "inventory_serial_lot_id_inventory_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_location_balance" ADD CONSTRAINT "stock_location_balance_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_location_balance" ADD CONSTRAINT "stock_location_balance_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_location_balance" ADD CONSTRAINT "stock_location_balance_bin_id_warehouse_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "public"."warehouse_bin"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_location_balance" ADD CONSTRAINT "stock_location_balance_lot_id_inventory_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_location_balance" ADD CONSTRAINT "stock_location_balance_serial_id_inventory_serial_id_fk" FOREIGN KEY ("serial_id") REFERENCES "public"."inventory_serial"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_bin" ADD CONSTRAINT "warehouse_bin_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inventory_lot_no" ON "inventory_lot" USING btree ("master_fn","company_fn","product_id","lot_no");--> statement-breakpoint
CREATE INDEX "idx_inventory_lot_expiry" ON "inventory_lot" USING btree ("master_fn","company_fn","product_id","expiry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inventory_serial_no" ON "inventory_serial" USING btree ("master_fn","company_fn","product_id","serial_no");--> statement-breakpoint
CREATE INDEX "idx_inventory_serial_status" ON "inventory_serial" USING btree ("master_fn","company_fn","product_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_stock_location_balance" ON "stock_location_balance" USING btree ("master_fn","company_fn","product_id","warehouse_id","bin_id","tracking_key");--> statement-breakpoint
CREATE INDEX "idx_stock_location_tracking" ON "stock_location_balance" USING btree ("master_fn","company_fn","product_id","tracking_key","warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_warehouse_bin_code" ON "warehouse_bin" USING btree ("master_fn","company_fn","warehouse_id","code");--> statement-breakpoint
CREATE INDEX "idx_warehouse_bin_active" ON "warehouse_bin" USING btree ("master_fn","company_fn","warehouse_id","is_active");--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_bin_id_warehouse_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "public"."warehouse_bin"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_lot_id_inventory_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_serial_id_inventory_serial_id_fk" FOREIGN KEY ("serial_id") REFERENCES "public"."inventory_serial"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "ck_product_tracking_type" CHECK ("product"."tracking_type" in ('none', 'lot', 'serial'));--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "ck_stock_movement_direction" CHECK ("stock_movement"."direction" in ('in', 'out'));
--> statement-breakpoint
INSERT INTO "warehouse_bin" (
	"master_fn", "company_fn", "warehouse_id", "code", "name", "is_system", "is_active"
)
SELECT "master_fn", "company_fn", "id", 'DEFAULT', 'Default Bin', true, true
FROM "warehouse"
ON CONFLICT ("master_fn", "company_fn", "warehouse_id", "code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "stock_location_balance" (
	"master_fn", "company_fn", "product_id", "warehouse_id", "bin_id",
	"tracking_key", "qty"
)
SELECT
	sl."master_fn", sl."company_fn", sl."product_id", sl."warehouse_id", wb."id",
	'none', sl."qty"
FROM "stock_level" sl
JOIN "warehouse_bin" wb
	ON wb."master_fn" = sl."master_fn"
	AND wb."company_fn" = sl."company_fn"
	AND wb."warehouse_id" = sl."warehouse_id"
	AND wb."code" = 'DEFAULT'
JOIN "product" p
	ON p."id" = sl."product_id"
	AND p."master_fn" = sl."master_fn"
	AND p."company_fn" = sl."company_fn"
WHERE p."tracking_type" = 'none'
ON CONFLICT (
	"master_fn", "company_fn", "product_id", "warehouse_id", "bin_id", "tracking_key"
) DO NOTHING;
--> statement-breakpoint
UPDATE "stock_movement" m
SET "bin_id" = wb."id"
FROM "warehouse_bin" wb
WHERE m."bin_id" IS NULL
	AND wb."master_fn" = m."master_fn"
	AND wb."company_fn" = m."company_fn"
	AND wb."warehouse_id" = m."warehouse_id"
	AND wb."code" = 'DEFAULT';
