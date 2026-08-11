CREATE TABLE "staff_appointment_reminder" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "staff_appointment_reminder_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"appointment_id" bigint NOT NULL,
	"occurrence_start_at" timestamp with time zone NOT NULL,
	"reminder_at" timestamp with time zone NOT NULL,
	"recipient_user_id" bigint,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_staff_appointment_reminder_status" CHECK ("staff_appointment_reminder"."status" in ('pending', 'sent', 'failed', 'superseded')),
	CONSTRAINT "ck_staff_appointment_reminder_attempts" CHECK ("staff_appointment_reminder"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "staff_appointment_outbound_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "staff_appointment_outbound_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"connection_id" bigint NOT NULL,
	"appointment_id" bigint NOT NULL,
	"appointment_revision_no" integer NOT NULL,
	"occurrence_start_at" timestamp with time zone NOT NULL,
	"event_type" text NOT NULL,
	"event_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"external_event_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_staff_appointment_outbound_event_type" CHECK ("staff_appointment_outbound_event"."event_type" in ('created', 'changed', 'cancelled')),
	CONSTRAINT "ck_staff_appointment_outbound_event_status" CHECK ("staff_appointment_outbound_event"."status" in ('pending', 'delivered', 'failed', 'superseded')),
	CONSTRAINT "ck_staff_appointment_outbound_event_attempts" CHECK ("staff_appointment_outbound_event"."attempts" >= 0),
	CONSTRAINT "ck_staff_appointment_outbound_event_revision" CHECK ("staff_appointment_outbound_event"."appointment_revision_no" > 0)
);
--> statement-breakpoint
ALTER TABLE "staff_appointment" ADD COLUMN "time_zone" text DEFAULT 'Asia/Singapore' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_appointment" ADD COLUMN "recurrence_rule" text;--> statement-breakpoint
ALTER TABLE "staff_appointment" ADD COLUMN "reminder_minutes_before" integer;--> statement-breakpoint
ALTER TABLE "staff_appointment" ADD COLUMN "sync_to_external" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_appointment_reminder" ADD CONSTRAINT "staff_appointment_reminder_appointment_id_staff_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."staff_appointment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_appointment_reminder" ADD CONSTRAINT "staff_appointment_reminder_recipient_user_id_app_user_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_appointment_outbound_event" ADD CONSTRAINT "staff_appointment_outbound_event_connection_id_calendar_outbound_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_outbound_connection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_appointment_outbound_event" ADD CONSTRAINT "staff_appointment_outbound_event_appointment_id_staff_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."staff_appointment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_appointment_reminder_occurrence" ON "staff_appointment_reminder" USING btree ("master_fn","company_fn","appointment_id","occurrence_start_at");--> statement-breakpoint
CREATE INDEX "idx_staff_appointment_reminder_pending" ON "staff_appointment_reminder" USING btree ("status","available_at","reminder_at","id");--> statement-breakpoint
CREATE INDEX "idx_staff_appointment_reminder_appointment" ON "staff_appointment_reminder" USING btree ("master_fn","company_fn","appointment_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_appointment_outbound_event_key" ON "staff_appointment_outbound_event" USING btree ("master_fn","company_fn","event_key");--> statement-breakpoint
CREATE INDEX "idx_staff_appointment_outbound_event_pending" ON "staff_appointment_outbound_event" USING btree ("status","available_at","id");--> statement-breakpoint
CREATE INDEX "idx_staff_appointment_outbound_event_appointment" ON "staff_appointment_outbound_event" USING btree ("master_fn","company_fn","appointment_id","occurrence_start_at","id");--> statement-breakpoint
CREATE INDEX "idx_staff_appointment_outbound_event_connection" ON "staff_appointment_outbound_event" USING btree ("master_fn","company_fn","connection_id","id");--> statement-breakpoint
ALTER TABLE "staff_appointment" ADD CONSTRAINT "ck_staff_appointment_timezone" CHECK (char_length(trim("staff_appointment"."time_zone")) between 1 and 64);--> statement-breakpoint
ALTER TABLE "staff_appointment" ADD CONSTRAINT "ck_staff_appointment_recurrence" CHECK ("staff_appointment"."recurrence_rule" is null or char_length(trim("staff_appointment"."recurrence_rule")) between 1 and 500);--> statement-breakpoint
ALTER TABLE "staff_appointment" ADD CONSTRAINT "ck_staff_appointment_reminder" CHECK ("staff_appointment"."reminder_minutes_before" is null or "staff_appointment"."reminder_minutes_before" between 0 and 10080);