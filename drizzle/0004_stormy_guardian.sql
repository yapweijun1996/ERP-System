CREATE TABLE IF NOT EXISTS "api_idempotency" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "api_idempotency_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"idempotency_key" text NOT NULL,
	"operation" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_session" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"csrf_hash" text NOT NULL,
	"user_id" bigint NOT NULL,
	"master_fn" text NOT NULL,
	"active_company_fn" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text,
	"actor_user_id" bigint,
	"request_id" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_rate_limit" (
	"identifier_hash" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"topic" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"delivered_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_token" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "password_reset_token_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permission" (
	"master_fn" text NOT NULL,
	"role_id" bigint NOT NULL,
	"permission_key" text NOT NULL,
	"allowed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permission_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_invitation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_invitation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"email" text NOT NULL,
	"role_id" bigint NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_order" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_invoice" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_idempotency" ADD CONSTRAINT "api_idempotency_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app_session" ADD CONSTRAINT "app_session_user_id_app_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app_session" ADD CONSTRAINT "app_session_active_company_fn_company_company_fn_fk" FOREIGN KEY ("active_company_fn") REFERENCES "public"."company"("company_fn") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_user_id_app_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("role_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_role_id_role_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("role_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_invited_by_user_id_app_user_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_idempotency_actor_key" ON "api_idempotency" USING btree ("master_fn","company_fn","actor_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_idempotency_expiry" ON "api_idempotency" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_user" ON "app_session" USING btree ("master_fn","user_id","revoked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_expiry" ON "app_session" USING btree ("expires_at","idle_expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_tenant_time" ON "audit_log" USING btree ("master_fn","company_fn","occurred_at","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_entity" ON "audit_log" USING btree ("master_fn","company_fn","entity","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_request" ON "audit_log" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbox_pending" ON "outbox_event" USING btree ("delivered_at","available_at","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbox_tenant_aggregate" ON "outbox_event" USING btree ("master_fn","company_fn","aggregate_type","aggregate_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_password_reset_token" ON "password_reset_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_password_reset_user" ON "password_reset_token" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_role_permission_master" ON "role_permission" USING btree ("master_fn","permission_key","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_invitation_token" ON "user_invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invitation_tenant_email" ON "user_invitation" USING btree ("master_fn","company_fn","email");