CREATE TABLE "employee_payout_profile" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_payout_profile_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"employee_id" bigint NOT NULL,
	"bank_country" text NOT NULL,
	"currency" text NOT NULL,
	"bank_code" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_holder_masked" text NOT NULL,
	"account_number_masked" text NOT NULL,
	"details_envelope" jsonb NOT NULL,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"verified_by_user_id" bigint,
	"verified_at" timestamp with time zone,
	"verification_reason" text,
	"verification_invalidated_at" timestamp with time zone,
	"verification_invalidated_reason" text,
	"created_by_user_id" bigint NOT NULL,
	"updated_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_employee_payout_profile_country" CHECK ("employee_payout_profile"."bank_country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "ck_employee_payout_profile_currency" CHECK ("employee_payout_profile"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_employee_payout_profile_bank_code" CHECK (char_length("employee_payout_profile"."bank_code") between 2 and 20),
	CONSTRAINT "ck_employee_payout_profile_bank_name" CHECK (char_length("employee_payout_profile"."bank_name") between 2 and 120),
	CONSTRAINT "ck_employee_payout_profile_masks" CHECK (char_length("employee_payout_profile"."account_holder_masked") between 2 and 160
      and char_length("employee_payout_profile"."account_number_masked") between 4 and 40),
	CONSTRAINT "ck_employee_payout_profile_status" CHECK ("employee_payout_profile"."verification_status" in ('unverified','verified')),
	CONSTRAINT "ck_employee_payout_profile_version" CHECK ("employee_payout_profile"."version" > 0),
	CONSTRAINT "ck_employee_payout_profile_verification" CHECK (("employee_payout_profile"."verification_status" = 'verified'
      and "employee_payout_profile"."verified_by_user_id" is not null
      and "employee_payout_profile"."verified_at" is not null
      and char_length("employee_payout_profile"."verification_reason") between 3 and 500
      and "employee_payout_profile"."verification_invalidated_at" is null
      and "employee_payout_profile"."verification_invalidated_reason" is null)
      or ("employee_payout_profile"."verification_status" = 'unverified'
        and "employee_payout_profile"."verified_by_user_id" is null
        and "employee_payout_profile"."verified_at" is null
        and "employee_payout_profile"."verification_reason" is null
        and ("employee_payout_profile"."verification_invalidated_at" is null
          or char_length("employee_payout_profile"."verification_invalidated_reason") between 3 and 500)))
);
--> statement-breakpoint
CREATE TABLE "employee_payout_profile_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_payout_profile_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"profile_id" bigint NOT NULL,
	"employee_id" bigint NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"profile_version" integer NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_employee_payout_profile_event_type" CHECK ("employee_payout_profile_event"."event_type" in ('created','updated','verified','revealed')),
	CONSTRAINT "ck_employee_payout_profile_event_version" CHECK ("employee_payout_profile_event"."profile_version" > 0),
	CONSTRAINT "ck_employee_payout_profile_event_reason" CHECK ("employee_payout_profile_event"."reason" is null or char_length("employee_payout_profile_event"."reason") between 3 and 500)
);
--> statement-breakpoint
ALTER TABLE "employee_payout_profile" ADD CONSTRAINT "employee_payout_profile_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_payout_profile" ADD CONSTRAINT "employee_payout_profile_currency_currency_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_payout_profile" ADD CONSTRAINT "employee_payout_profile_verified_by_user_id_app_user_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_payout_profile" ADD CONSTRAINT "employee_payout_profile_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_payout_profile" ADD CONSTRAINT "employee_payout_profile_updated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_payout_profile_event" ADD CONSTRAINT "employee_payout_profile_event_profile_id_employee_payout_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."employee_payout_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_payout_profile_event" ADD CONSTRAINT "employee_payout_profile_event_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_payout_profile_event" ADD CONSTRAINT "employee_payout_profile_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_employee_payout_profile_employee" ON "employee_payout_profile" USING btree ("master_fn","company_fn","employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_payout_profile_verification" ON "employee_payout_profile" USING btree ("master_fn","company_fn","verification_status","employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_payout_profile_event_profile" ON "employee_payout_profile_event" USING btree ("master_fn","company_fn","profile_id","id");--> statement-breakpoint
CREATE INDEX "idx_employee_payout_profile_event_actor" ON "employee_payout_profile_event" USING btree ("master_fn","company_fn","actor_user_id","occurred_at","id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_employee_payout_event_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'employee payout profile events are immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS employee_payout_profile_event_immutable
ON employee_payout_profile_event;
--> statement-breakpoint
CREATE TRIGGER employee_payout_profile_event_immutable
BEFORE UPDATE OR DELETE ON employee_payout_profile_event
FOR EACH ROW EXECUTE FUNCTION prevent_employee_payout_event_change();
