CREATE TABLE "leave_cancellation_request" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_cancellation_request_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"request_id" bigint NOT NULL,
	"request_version" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"requested_by_user_id" bigint NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by_user_id" bigint,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	CONSTRAINT "ck_leave_cancellation_request_version" CHECK ("leave_cancellation_request"."request_version" > 0 and "leave_cancellation_request"."version" > 0),
	CONSTRAINT "ck_leave_cancellation_status" CHECK ("leave_cancellation_request"."status" in ('pending', 'approved', 'rejected')),
	CONSTRAINT "ck_leave_cancellation_reason" CHECK (char_length(trim("leave_cancellation_request"."reason")) between 3 and 500),
	CONSTRAINT "ck_leave_cancellation_decision" CHECK (("leave_cancellation_request"."status" = 'pending' and "leave_cancellation_request"."decided_by_user_id" is null and "leave_cancellation_request"."decided_at" is null)
      or ("leave_cancellation_request"."status" <> 'pending' and "leave_cancellation_request"."decided_by_user_id" is not null and "leave_cancellation_request"."decided_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "leave_evidence" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_evidence_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"request_id" bigint NOT NULL,
	"revision_no" integer NOT NULL,
	"evidence_type" text DEFAULT 'medical_certificate' NOT NULL,
	"state" text DEFAULT 'received' NOT NULL,
	"document_reference" text NOT NULL,
	"original_file_name" text,
	"mime_type" text,
	"note" text,
	"event_key" text NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_leave_evidence_revision" CHECK ("leave_evidence"."revision_no" > 0),
	CONSTRAINT "ck_leave_evidence_type" CHECK ("leave_evidence"."evidence_type" in ('medical_certificate', 'supporting_document')),
	CONSTRAINT "ck_leave_evidence_state" CHECK ("leave_evidence"."state" in ('received', 'verified', 'rejected')),
	CONSTRAINT "ck_leave_evidence_reference" CHECK (char_length(trim("leave_evidence"."document_reference")) between 3 and 200)
);
--> statement-breakpoint
CREATE TABLE "leave_request_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_request_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"request_id" bigint NOT NULL,
	"revision_no" integer,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"reason" text,
	"event_key" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_leave_request_event_type" CHECK ("leave_request_event"."event_type" in (
      'created_draft', 'amended', 'submitted', 'approved', 'rejected',
      'withdrawn', 'voided', 'cancellation_requested',
      'cancellation_approved', 'cancellation_rejected'
    ))
);
--> statement-breakpoint
CREATE TABLE "leave_request_revision" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_request_revision_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"request_id" bigint NOT NULL,
	"revision_no" integer NOT NULL,
	"leave_type_id" bigint NOT NULL,
	"policy_version_id" bigint NOT NULL,
	"calendar_version_id" bigint NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"unit" text NOT NULL,
	"days" numeric(8, 2) NOT NULL,
	"reason" text,
	"change_reason" text,
	"evidence_required" boolean DEFAULT false NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_leave_request_revision_no" CHECK ("leave_request_revision"."revision_no" > 0),
	CONSTRAINT "ck_leave_request_revision_days" CHECK ("leave_request_revision"."days" > 0 and mod("leave_request_revision"."days" * 2, 1) = 0),
	CONSTRAINT "ck_leave_request_revision_dates" CHECK ("leave_request_revision"."end_date" >= "leave_request_revision"."start_date"),
	CONSTRAINT "ck_leave_request_revision_unit" CHECK ("leave_request_revision"."unit" in ('full_day', 'half_day_am', 'half_day_pm'))
);
--> statement-breakpoint
ALTER TABLE "leave_request" DROP CONSTRAINT IF EXISTS "ck_leave_request_status";--> statement-breakpoint
ALTER TABLE "leave_request" DROP CONSTRAINT IF EXISTS "ck_leave_request_type";--> statement-breakpoint
ALTER TABLE "leave_request" ALTER COLUMN "days" SET DATA TYPE numeric(8, 2);--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "leave_type_id" bigint;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "policy_version_id" bigint;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "calendar_version_id" bigint;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "current_revision_no" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "legacy_policy" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "created_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "on_behalf_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "withdrawn_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave_request" ADD COLUMN "decided_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "leave_cancellation_request" ADD CONSTRAINT "leave_cancellation_request_request_id_leave_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."leave_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_cancellation_request" ADD CONSTRAINT "leave_cancellation_request_requested_by_user_id_app_user_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_cancellation_request" ADD CONSTRAINT "leave_cancellation_request_decided_by_user_id_app_user_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_evidence" ADD CONSTRAINT "leave_evidence_request_id_leave_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."leave_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_evidence" ADD CONSTRAINT "leave_evidence_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_event" ADD CONSTRAINT "leave_request_event_request_id_leave_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."leave_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_event" ADD CONSTRAINT "leave_request_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_revision" ADD CONSTRAINT "leave_request_revision_request_id_leave_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."leave_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_revision" ADD CONSTRAINT "leave_request_revision_leave_type_id_leave_type_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_revision" ADD CONSTRAINT "leave_request_revision_policy_version_id_leave_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."leave_policy_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_revision" ADD CONSTRAINT "leave_request_revision_calendar_version_id_working_calendar_version_id_fk" FOREIGN KEY ("calendar_version_id") REFERENCES "public"."working_calendar_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request_revision" ADD CONSTRAINT "leave_request_revision_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leave_cancellation_pending" ON "leave_cancellation_request" USING btree ("master_fn","company_fn","request_id") WHERE "leave_cancellation_request"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_leave_cancellation_history" ON "leave_cancellation_request" USING btree ("master_fn","company_fn","request_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leave_evidence_event_key" ON "leave_evidence" USING btree ("master_fn","company_fn","event_key");--> statement-breakpoint
CREATE INDEX "idx_leave_evidence_projection" ON "leave_evidence" USING btree ("master_fn","company_fn","request_id","revision_no","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leave_request_event_key" ON "leave_request_event" USING btree ("master_fn","company_fn","event_key");--> statement-breakpoint
CREATE INDEX "idx_leave_request_event_history" ON "leave_request_event" USING btree ("master_fn","company_fn","request_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leave_request_revision" ON "leave_request_revision" USING btree ("master_fn","company_fn","request_id","revision_no");--> statement-breakpoint
CREATE INDEX "idx_leave_request_revision_current" ON "leave_request_revision" USING btree ("master_fn","company_fn","request_id","revision_no");--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_leave_type_id_leave_type_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_policy_version_id_leave_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."leave_policy_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_calendar_version_id_working_calendar_version_id_fk" FOREIGN KEY ("calendar_version_id") REFERENCES "public"."working_calendar_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_on_behalf_by_user_id_app_user_user_id_fk" FOREIGN KEY ("on_behalf_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_decided_by_user_id_app_user_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "ck_leave_request_version" CHECK ("leave_request"."version" > 0 and "leave_request"."current_revision_no" >= 0);--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "ck_leave_request_governance" CHECK ((
      "leave_request"."legacy_policy" = true
      and "leave_request"."current_revision_no" = 0
      and "leave_request"."leave_type_id" is null
      and "leave_request"."policy_version_id" is null
      and "leave_request"."calendar_version_id" is null
      and "leave_request"."unit" is null
    ) or (
      "leave_request"."legacy_policy" = false
      and "leave_request"."current_revision_no" > 0
      and "leave_request"."leave_type_id" is not null
      and "leave_request"."policy_version_id" is not null
      and "leave_request"."calendar_version_id" is not null
      and "leave_request"."unit" in ('full_day', 'half_day_am', 'half_day_pm')
    ));--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "ck_leave_request_status" CHECK ("leave_request"."status" in (
      'draft', 'pending', 'approved', 'rejected', 'withdrawn', 'voided', 'cancelled'
    ));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_leave_application_fact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS leave_request_revision_append_only ON "leave_request_revision";
--> statement-breakpoint
CREATE TRIGGER leave_request_revision_append_only
BEFORE UPDATE OR DELETE ON "leave_request_revision"
FOR EACH ROW
EXECUTE FUNCTION prevent_leave_application_fact_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS leave_request_event_append_only ON "leave_request_event";
--> statement-breakpoint
CREATE TRIGGER leave_request_event_append_only
BEFORE UPDATE OR DELETE ON "leave_request_event"
FOR EACH ROW
EXECUTE FUNCTION prevent_leave_application_fact_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS leave_evidence_append_only ON "leave_evidence";
--> statement-breakpoint
CREATE TRIGGER leave_evidence_append_only
BEFORE UPDATE OR DELETE ON "leave_evidence"
FOR EACH ROW
EXECUTE FUNCTION prevent_leave_application_fact_mutation();
