CREATE TABLE "calendar_outbound_connection" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "calendar_outbound_connection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"calendar_ref" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_calendar_outbound_provider" CHECK ("calendar_outbound_connection"."provider" in ('generic', 'google', 'microsoft'))
);
--> statement-breakpoint
CREATE TABLE "calendar_outbound_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "calendar_outbound_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"connection_id" bigint NOT NULL,
	"leave_request_id" bigint NOT NULL,
	"leave_revision_no" integer NOT NULL,
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
	CONSTRAINT "ck_calendar_outbound_event_revision" CHECK ("calendar_outbound_event"."leave_revision_no" > 0),
	CONSTRAINT "ck_calendar_outbound_event_type" CHECK ("calendar_outbound_event"."event_type" in ('approved', 'changed', 'cancelled')),
	CONSTRAINT "ck_calendar_outbound_event_status" CHECK ("calendar_outbound_event"."status" in ('pending', 'delivered', 'failed', 'superseded')),
	CONSTRAINT "ck_calendar_outbound_event_attempts" CHECK ("calendar_outbound_event"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "calendar_outbound_connection" ADD CONSTRAINT "calendar_outbound_connection_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_outbound_event" ADD CONSTRAINT "calendar_outbound_event_connection_id_calendar_outbound_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_outbound_connection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_outbound_event" ADD CONSTRAINT "calendar_outbound_event_leave_request_id_leave_request_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_calendar_outbound_connection" ON "calendar_outbound_connection" USING btree ("master_fn","company_fn","provider","calendar_ref");--> statement-breakpoint
CREATE INDEX "idx_calendar_outbound_connection_enabled" ON "calendar_outbound_connection" USING btree ("master_fn","company_fn","is_enabled","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_calendar_outbound_event_key" ON "calendar_outbound_event" USING btree ("master_fn","company_fn","event_key");--> statement-breakpoint
CREATE INDEX "idx_calendar_outbound_event_pending" ON "calendar_outbound_event" USING btree ("status","available_at","id");--> statement-breakpoint
CREATE INDEX "idx_calendar_outbound_event_leave" ON "calendar_outbound_event" USING btree ("master_fn","company_fn","leave_request_id","id");--> statement-breakpoint
CREATE INDEX "idx_calendar_outbound_event_connection" ON "calendar_outbound_event" USING btree ("master_fn","company_fn","connection_id","id");