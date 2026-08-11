CREATE TABLE "staff_appointment" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "staff_appointment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"employee_id" bigint NOT NULL,
	"appointment_type" text DEFAULT 'meeting' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"updated_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_staff_appointment_type" CHECK ("staff_appointment"."appointment_type" in ('meeting', 'training', 'interview', 'client_visit', 'medical', 'other')),
	CONSTRAINT "ck_staff_appointment_status" CHECK ("staff_appointment"."status" in ('scheduled', 'completed', 'cancelled')),
	CONSTRAINT "ck_staff_appointment_title" CHECK (char_length(trim("staff_appointment"."title")) between 1 and 200),
	CONSTRAINT "ck_staff_appointment_description" CHECK ("staff_appointment"."description" is null or char_length("staff_appointment"."description") <= 2000),
	CONSTRAINT "ck_staff_appointment_location" CHECK ("staff_appointment"."location" is null or char_length("staff_appointment"."location") <= 200),
	CONSTRAINT "ck_staff_appointment_dates" CHECK ("staff_appointment"."end_at" > "staff_appointment"."start_at"),
	CONSTRAINT "ck_staff_appointment_record_version" CHECK ("staff_appointment"."record_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "staff_appointment" ADD CONSTRAINT "staff_appointment_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_appointment" ADD CONSTRAINT "staff_appointment_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_appointment" ADD CONSTRAINT "staff_appointment_updated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_staff_appointment_employee_time" ON "staff_appointment" USING btree ("master_fn","company_fn","employee_id","start_at","end_at","id");--> statement-breakpoint
CREATE INDEX "idx_staff_appointment_calendar" ON "staff_appointment" USING btree ("master_fn","company_fn","start_at","end_at","status","id");