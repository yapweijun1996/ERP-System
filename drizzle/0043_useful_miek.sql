CREATE TABLE "app_notification" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_notification_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"recipient_user_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"subject" text NOT NULL,
	"detail" text NOT NULL,
	"route" text,
	"entity_ref" text,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_app_notification_kind" CHECK ("app_notification"."kind" in ('approval_required', 'inventory_attention', 'quality_attention', 'finance_attention', 'sales_attention', 'integration_completed', 'system_notice')),
	CONSTRAINT "ck_app_notification_severity" CHECK ("app_notification"."severity" in ('info', 'success', 'warning', 'critical')),
	CONSTRAINT "ck_app_notification_subject" CHECK (char_length(trim("app_notification"."subject")) between 1 and 160),
	CONSTRAINT "ck_app_notification_detail" CHECK (char_length(trim("app_notification"."detail")) between 1 and 500),
	CONSTRAINT "ck_app_notification_route" CHECK ("app_notification"."route" is null or "app_notification"."route" ~ '^[a-z][a-z0-9-]{0,63}$'),
	CONSTRAINT "ck_app_notification_entity_ref" CHECK ("app_notification"."entity_ref" is null or char_length("app_notification"."entity_ref") <= 80),
	CONSTRAINT "ck_app_notification_version" CHECK ("app_notification"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "app_notification" ADD CONSTRAINT "app_notification_recipient_user_id_app_user_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_app_notification_recipient_feed" ON "app_notification" USING btree ("master_fn","company_fn","recipient_user_id","id");