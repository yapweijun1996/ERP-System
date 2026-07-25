CREATE TABLE "leave_balance_entry" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_balance_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"employee_id" bigint NOT NULL,
	"leave_type_id" bigint NOT NULL,
	"policy_version_id" bigint NOT NULL,
	"entry_type" text NOT NULL,
	"entry_key" text NOT NULL,
	"balance_delta" numeric(10, 2) DEFAULT '0' NOT NULL,
	"reserved_delta" numeric(10, 2) DEFAULT '0' NOT NULL,
	"effective_date" date NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"note" text,
	"created_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_leave_balance_entry_type" CHECK ("leave_balance_entry"."entry_type" in (
      'grant', 'accrual', 'reserve', 'use', 'release', 'cancellation',
      'adjustment', 'carry_forward', 'expiry', 'encashment'
    )),
	CONSTRAINT "ck_leave_balance_nonzero" CHECK ("leave_balance_entry"."balance_delta" <> 0 or "leave_balance_entry"."reserved_delta" <> 0),
	CONSTRAINT "ck_leave_balance_half_day" CHECK (mod(abs("leave_balance_entry"."balance_delta") * 2, 1) = 0
      and mod(abs("leave_balance_entry"."reserved_delta") * 2, 1) = 0),
	CONSTRAINT "ck_leave_balance_entry_shape" CHECK (
      ("leave_balance_entry"."entry_type" in ('grant', 'accrual', 'carry_forward')
        and "leave_balance_entry"."balance_delta" > 0 and "leave_balance_entry"."reserved_delta" = 0)
      or ("leave_balance_entry"."entry_type" = 'reserve'
        and "leave_balance_entry"."balance_delta" = 0 and "leave_balance_entry"."reserved_delta" > 0)
      or ("leave_balance_entry"."entry_type" = 'release'
        and "leave_balance_entry"."balance_delta" = 0 and "leave_balance_entry"."reserved_delta" < 0)
      or ("leave_balance_entry"."entry_type" = 'use'
        and "leave_balance_entry"."balance_delta" < 0 and "leave_balance_entry"."reserved_delta" < 0)
      or ("leave_balance_entry"."entry_type" = 'cancellation'
        and "leave_balance_entry"."balance_delta" > 0 and "leave_balance_entry"."reserved_delta" = 0)
      or ("leave_balance_entry"."entry_type" in ('expiry', 'encashment')
        and "leave_balance_entry"."balance_delta" < 0 and "leave_balance_entry"."reserved_delta" = 0)
      or ("leave_balance_entry"."entry_type" = 'adjustment' and "leave_balance_entry"."reserved_delta" = 0)
    )
);
--> statement-breakpoint
ALTER TABLE "leave_balance_entry" ADD CONSTRAINT "leave_balance_entry_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_entry" ADD CONSTRAINT "leave_balance_entry_leave_type_id_leave_type_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_entry" ADD CONSTRAINT "leave_balance_entry_policy_version_id_leave_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."leave_policy_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_entry" ADD CONSTRAINT "leave_balance_entry_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leave_balance_entry_key" ON "leave_balance_entry" USING btree ("master_fn","company_fn","entry_key");--> statement-breakpoint
CREATE INDEX "idx_leave_balance_projection" ON "leave_balance_entry" USING btree ("master_fn","company_fn","employee_id","leave_type_id","effective_date","id");--> statement-breakpoint
CREATE INDEX "idx_leave_balance_source" ON "leave_balance_entry" USING btree ("master_fn","company_fn","source_type","source_id","id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_leave_balance_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'leave_balance_entry is append-only';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS leave_balance_entry_append_only ON "leave_balance_entry";
--> statement-breakpoint
CREATE TRIGGER leave_balance_entry_append_only
BEFORE UPDATE OR DELETE ON "leave_balance_entry"
FOR EACH ROW
EXECUTE FUNCTION prevent_leave_balance_entry_mutation();
