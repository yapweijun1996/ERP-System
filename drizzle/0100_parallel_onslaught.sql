ALTER TABLE "tax_rule" ADD COLUMN "tax_classification" text DEFAULT 'unclassified' NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rule" ADD COLUMN "input_tax_recoverable_pct" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rule" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "tax_rule" ADD COLUMN "source_effective_date" date;--> statement-breakpoint
ALTER TABLE "tax_rule" ADD COLUMN "approved_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "tax_rule" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD COLUMN "tax_classification" text DEFAULT 'unclassified' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD COLUMN "input_tax_recoverable_pct" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_return_line" ADD COLUMN "tax_classification" text DEFAULT 'unclassified' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_return_line" ADD COLUMN "input_tax_recoverable_pct" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_debit_note" ADD COLUMN "tax_classification" text DEFAULT 'unclassified' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_debit_note" ADD COLUMN "input_tax_recoverable_pct" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rule" ADD CONSTRAINT "ck_tax_rule_rate" CHECK ("tax_rule"."rate" >= 0);--> statement-breakpoint
ALTER TABLE "tax_rule" ADD CONSTRAINT "ck_tax_rule_dates" CHECK ("tax_rule"."valid_to" is null or "tax_rule"."valid_to" > "tax_rule"."valid_from");--> statement-breakpoint
ALTER TABLE "tax_rule" ADD CONSTRAINT "ck_tax_rule_classification" CHECK ("tax_rule"."tax_classification" in (
    'unclassified', 'gst_standard', 'gst_zero_rated', 'gst_exempt',
    'sst_sales', 'sst_service', 'sst_deductible', 'sst_exempt'
  ));--> statement-breakpoint
ALTER TABLE "tax_rule" ADD CONSTRAINT "ck_tax_rule_recoverable_pct" CHECK ("tax_rule"."input_tax_recoverable_pct" between 0.0000 and 100.0000);