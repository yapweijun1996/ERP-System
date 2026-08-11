ALTER TABLE "calendar_holiday" DROP CONSTRAINT "ck_calendar_holiday_status";--> statement-breakpoint
ALTER TABLE "calendar_holiday" DROP CONSTRAINT "ck_calendar_holiday_confirmation";--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD COLUMN "submitted_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD COLUMN "rejected_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD COLUMN "record_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD CONSTRAINT "calendar_holiday_submitted_by_user_id_app_user_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD CONSTRAINT "calendar_holiday_rejected_by_user_id_app_user_user_id_fk" FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD CONSTRAINT "ck_calendar_holiday_submission" CHECK (("calendar_holiday"."submitted_at" is null and "calendar_holiday"."submitted_by_user_id" is null)
      or ("calendar_holiday"."submitted_at" is not null and "calendar_holiday"."submitted_by_user_id" is not null));--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD CONSTRAINT "ck_calendar_holiday_rejection" CHECK (("calendar_holiday"."status" = 'rejected' and "calendar_holiday"."rejected_at" is not null and "calendar_holiday"."rejected_by_user_id" is not null and "calendar_holiday"."rejection_reason" is not null)
      or ("calendar_holiday"."status" <> 'rejected' and "calendar_holiday"."rejected_at" is null and "calendar_holiday"."rejected_by_user_id" is null and "calendar_holiday"."rejection_reason" is null));--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD CONSTRAINT "ck_calendar_holiday_record_version" CHECK ("calendar_holiday"."record_version" > 0);--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD CONSTRAINT "ck_calendar_holiday_status" CHECK ("calendar_holiday"."status" in ('draft', 'pending_approval', 'confirmed', 'rejected'));--> statement-breakpoint
ALTER TABLE "calendar_holiday" ADD CONSTRAINT "ck_calendar_holiday_confirmation" CHECK (("calendar_holiday"."status" = 'confirmed' and "calendar_holiday"."confirmed_at" is not null and "calendar_holiday"."confirmed_by_user_id" is not null)
      or ("calendar_holiday"."status" <> 'confirmed' and "calendar_holiday"."confirmed_at" is null and "calendar_holiday"."confirmed_by_user_id" is null));