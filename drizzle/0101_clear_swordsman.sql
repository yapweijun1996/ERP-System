ALTER TABLE "expense_line_policy_snapshot" DROP CONSTRAINT "ck_expense_line_policy_snapshot_tax";--> statement-breakpoint
ALTER TABLE "expense_policy_version" DROP CONSTRAINT "ck_expense_policy_dates";--> statement-breakpoint
ALTER TABLE "expense_line_policy_snapshot" ADD COLUMN "tax_classification" text DEFAULT 'unclassified' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_line_policy_snapshot" ADD CONSTRAINT "ck_expense_line_policy_snapshot_tax" CHECK ("expense_line_policy_snapshot"."tax_treatment" in ('input_tax','non_deductible','exempt')
      and "expense_line_policy_snapshot"."tax_rate" >= 0
      and "expense_line_policy_snapshot"."input_tax_recoverable_pct" between 0.0000 and 100.0000
      and "expense_line_policy_snapshot"."tax_classification" in (
        'unclassified', 'gst_standard', 'gst_zero_rated', 'gst_exempt',
        'sst_sales', 'sst_service', 'sst_deductible', 'sst_exempt'
      ));--> statement-breakpoint
ALTER TABLE "expense_policy_version" ADD CONSTRAINT "ck_expense_policy_dates" CHECK ("expense_policy_version"."valid_to" is null or "expense_policy_version"."valid_to" > "expense_policy_version"."valid_from");