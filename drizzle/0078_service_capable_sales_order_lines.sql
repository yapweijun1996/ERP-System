ALTER TABLE "sales_order_line" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_order_line" ADD COLUMN "line_type" text DEFAULT 'stock' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_order_line" ADD COLUMN "description" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "sales_order_line" ADD COLUMN "uom" text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
UPDATE "sales_order_line" AS l
SET "description" = COALESCE(p."name", 'Legacy order item ' || l."product_id"::text)
FROM "product" AS p
WHERE l."product_id" = p."id";--> statement-breakpoint
ALTER TABLE "sales_order_line" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_order_line" ALTER COLUMN "description" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sales_order_line" ADD CONSTRAINT "ck_sales_order_line_type" CHECK ("sales_order_line"."line_type" in ('stock', 'non_stock'));--> statement-breakpoint
ALTER TABLE "sales_order_line" ADD CONSTRAINT "ck_sales_order_line_product" CHECK (("sales_order_line"."line_type" = 'stock' and "sales_order_line"."product_id" is not null) or ("sales_order_line"."line_type" = 'non_stock' and "sales_order_line"."product_id" is null));--> statement-breakpoint
ALTER TABLE "sales_order_line" ADD CONSTRAINT "ck_sales_order_line_description" CHECK (length(trim("sales_order_line"."description")) > 0);--> statement-breakpoint
ALTER TABLE "sales_order_line" ADD CONSTRAINT "ck_sales_order_line_qty" CHECK ("sales_order_line"."qty" > 0 and "sales_order_line"."unit_price" >= 0);
