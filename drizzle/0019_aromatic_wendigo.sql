ALTER TABLE "product" ADD COLUMN "category" text DEFAULT 'Components' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "reorder_point" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "reorder_qty" numeric(18, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "ck_product_category" CHECK ("product"."category" in ('Components', 'Raw Materials', 'Finished Goods', 'Consumables', 'Packaging'));--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "ck_product_reorder_nonnegative" CHECK ("product"."reorder_point" >= 0 and "product"."reorder_qty" >= 0);