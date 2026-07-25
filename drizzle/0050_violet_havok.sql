CREATE TABLE "calendar_holiday" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "calendar_holiday_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"calendar_version_id" bigint NOT NULL,
	"holiday_date" date NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"country" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"confirmed_by_user_id" bigint,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_calendar_holiday_source" CHECK ("calendar_holiday"."source" in ('official', 'company')),
	CONSTRAINT "ck_calendar_holiday_status" CHECK ("calendar_holiday"."status" in ('draft', 'confirmed')),
	CONSTRAINT "ck_calendar_holiday_confirmation" CHECK (("calendar_holiday"."status" = 'confirmed' and "calendar_holiday"."confirmed_at" is not null and "calendar_holiday"."confirmed_by_user_id" is not null)
      or ("calendar_holiday"."status" = 'draft' and "calendar_holiday"."confirmed_at" is null and "calendar_holiday"."confirmed_by_user_id" is null))
);
--> statement-breakpoint
CREATE TABLE "leave_policy_version" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_policy_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"leave_type_id" bigint NOT NULL,
	"calendar_id" bigint NOT NULL,
	"version_no" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"unit_mode" text DEFAULT 'full_and_half_day' NOT NULL,
	"annual_entitlement_days" numeric(8, 2) DEFAULT '0' NOT NULL,
	"accrual_method" text DEFAULT 'upfront' NOT NULL,
	"carry_forward_days" numeric(8, 2) DEFAULT '0' NOT NULL,
	"carry_expiry_months" integer,
	"evidence_after_days" numeric(8, 2),
	"staffing_action" text DEFAULT 'warn' NOT NULL,
	"minimum_staff" integer DEFAULT 0 NOT NULL,
	"encashment_allowed" boolean DEFAULT false NOT NULL,
	"encashment_max_days" numeric(8, 2) DEFAULT '0' NOT NULL,
	"eligible_employment_types" jsonb NOT NULL,
	"confirmed_by_user_id" bigint,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_leave_policy_version_no" CHECK ("leave_policy_version"."version_no" > 0),
	CONSTRAINT "ck_leave_policy_dates" CHECK ("leave_policy_version"."effective_to" is null or "leave_policy_version"."effective_to" >= "leave_policy_version"."effective_from"),
	CONSTRAINT "ck_leave_policy_status" CHECK ("leave_policy_version"."status" in ('draft', 'confirmed', 'retired')),
	CONSTRAINT "ck_leave_policy_unit" CHECK ("leave_policy_version"."unit_mode" = 'full_and_half_day'),
	CONSTRAINT "ck_leave_policy_accrual" CHECK ("leave_policy_version"."accrual_method" in ('none', 'upfront', 'monthly')),
	CONSTRAINT "ck_leave_policy_staffing" CHECK ("leave_policy_version"."staffing_action" in ('warn', 'extra_approval', 'block') and "leave_policy_version"."minimum_staff" >= 0),
	CONSTRAINT "ck_leave_policy_values" CHECK ("leave_policy_version"."annual_entitlement_days" >= 0
      and "leave_policy_version"."carry_forward_days" >= 0
      and ("leave_policy_version"."carry_expiry_months" is null or "leave_policy_version"."carry_expiry_months" > 0)
      and ("leave_policy_version"."evidence_after_days" is null or "leave_policy_version"."evidence_after_days" >= 0.5)
      and "leave_policy_version"."encashment_max_days" >= 0),
	CONSTRAINT "ck_leave_policy_encashment" CHECK ("leave_policy_version"."encashment_allowed" = true or "leave_policy_version"."encashment_max_days" = 0),
	CONSTRAINT "ck_leave_policy_confirmation" CHECK (("leave_policy_version"."status" = 'confirmed' and "leave_policy_version"."confirmed_at" is not null and "leave_policy_version"."confirmed_by_user_id" is not null)
      or ("leave_policy_version"."status" <> 'confirmed'))
);
--> statement-breakpoint
CREATE TABLE "leave_type" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_type_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"paid" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_calendar" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "working_calendar_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"time_zone" text DEFAULT 'Asia/Singapore' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_calendar_version" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "working_calendar_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"calendar_id" bigint NOT NULL,
	"version_no" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"weekdays" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"confirmed_by_user_id" bigint,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_working_calendar_version_no" CHECK ("working_calendar_version"."version_no" > 0),
	CONSTRAINT "ck_working_calendar_version_dates" CHECK ("working_calendar_version"."effective_to" is null or "working_calendar_version"."effective_to" >= "working_calendar_version"."effective_from"),
	CONSTRAINT "ck_working_calendar_version_status" CHECK ("working_calendar_version"."status" in ('draft', 'confirmed', 'retired')),
	CONSTRAINT "ck_working_calendar_version_confirmation" CHECK (("working_calendar_version"."status" = 'confirmed' and "working_calendar_version"."confirmed_at" is not null and "working_calendar_version"."confirmed_by_user_id" is not null)
      or ("working_calendar_version"."status" <> 'confirmed'))
);
--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD CONSTRAINT "calendar_holiday_calendar_version_id_working_calendar_version_id_fk" FOREIGN KEY ("calendar_version_id") REFERENCES "public"."working_calendar_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD CONSTRAINT "calendar_holiday_confirmed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_policy_version" ADD CONSTRAINT "leave_policy_version_leave_type_id_leave_type_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_policy_version" ADD CONSTRAINT "leave_policy_version_calendar_id_working_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."working_calendar"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_policy_version" ADD CONSTRAINT "leave_policy_version_confirmed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_calendar_version" ADD CONSTRAINT "working_calendar_version_calendar_id_working_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."working_calendar"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_calendar_version" ADD CONSTRAINT "working_calendar_version_confirmed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_calendar_holiday" ON "calendar_holiday" USING btree ("master_fn","company_fn","calendar_version_id","holiday_date","name");--> statement-breakpoint
CREATE INDEX "idx_calendar_holiday_effective" ON "calendar_holiday" USING btree ("master_fn","company_fn","calendar_version_id","status","holiday_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leave_policy_version" ON "leave_policy_version" USING btree ("master_fn","company_fn","leave_type_id","version_no");--> statement-breakpoint
CREATE INDEX "idx_leave_policy_version_effective" ON "leave_policy_version" USING btree ("master_fn","company_fn","leave_type_id","status","effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leave_type_code" ON "leave_type" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leave_type_scope_id" ON "leave_type" USING btree ("id","master_fn","company_fn");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_working_calendar_code" ON "working_calendar" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_working_calendar_scope_id" ON "working_calendar" USING btree ("id","master_fn","company_fn");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_working_calendar_default" ON "working_calendar" USING btree ("master_fn","company_fn") WHERE "working_calendar"."is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_working_calendar_version" ON "working_calendar_version" USING btree ("master_fn","company_fn","calendar_id","version_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_working_calendar_version_scope_id" ON "working_calendar_version" USING btree ("id","master_fn","company_fn");--> statement-breakpoint
CREATE INDEX "idx_working_calendar_version_effective" ON "working_calendar_version" USING btree ("master_fn","company_fn","calendar_id","status","effective_from","effective_to");