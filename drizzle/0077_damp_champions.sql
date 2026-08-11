ALTER TABLE "sales_enquiry_line" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_quotation_line" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_enquiry_line" ADD COLUMN "line_type" text DEFAULT 'stock' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_enquiry_line" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "sales_enquiry_line" ADD COLUMN "uom" text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_quotation_line" ADD COLUMN "line_type" text DEFAULT 'stock' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_quotation_line" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "sales_quotation_line" ADD COLUMN "uom" text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
UPDATE "sales_enquiry_line" AS l SET "description" = p."name", "uom" = p."uom" FROM "product" AS p WHERE l."product_id" = p."id";--> statement-breakpoint
UPDATE "sales_quotation_line" AS l SET "description" = p."name", "uom" = p."uom" FROM "product" AS p WHERE l."product_id" = p."id";--> statement-breakpoint
ALTER TABLE "sales_enquiry_line" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_quotation_line" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_enquiry_line" ADD CONSTRAINT "ck_sales_enquiry_line_type" CHECK ("sales_enquiry_line"."line_type" in ('stock', 'non_stock'));--> statement-breakpoint
ALTER TABLE "sales_enquiry_line" ADD CONSTRAINT "ck_sales_enquiry_line_product" CHECK (("sales_enquiry_line"."line_type" = 'stock' and "sales_enquiry_line"."product_id" is not null) or ("sales_enquiry_line"."line_type" = 'non_stock' and "sales_enquiry_line"."product_id" is null));--> statement-breakpoint
ALTER TABLE "sales_enquiry_line" ADD CONSTRAINT "ck_sales_enquiry_line_description" CHECK (length(trim("sales_enquiry_line"."description")) > 0);--> statement-breakpoint
ALTER TABLE "sales_quotation_line" ADD CONSTRAINT "ck_sales_quotation_line_type" CHECK ("sales_quotation_line"."line_type" in ('stock', 'non_stock'));--> statement-breakpoint
ALTER TABLE "sales_quotation_line" ADD CONSTRAINT "ck_sales_quotation_line_product" CHECK (("sales_quotation_line"."line_type" = 'stock' and "sales_quotation_line"."product_id" is not null) or ("sales_quotation_line"."line_type" = 'non_stock' and "sales_quotation_line"."product_id" is null));--> statement-breakpoint
ALTER TABLE "sales_quotation_line" ADD CONSTRAINT "ck_sales_quotation_line_description" CHECK (length(trim("sales_quotation_line"."description")) > 0);
