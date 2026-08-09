CREATE TABLE "platform_principal" (
	"principal_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "platform_principal_principal_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"principal_key" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_principal_role" (
	"principal_id" bigint NOT NULL,
	"platform_role_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_principal_role_principal_id_platform_role_id_pk" PRIMARY KEY("principal_id","platform_role_id")
);
--> statement-breakpoint
CREATE TABLE "platform_role" (
	"platform_role_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "platform_role_platform_role_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_system_role" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_role_permission" (
	"platform_role_id" bigint NOT NULL,
	"permission_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_role_permission_platform_role_id_permission_key_pk" PRIMARY KEY("platform_role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "platform_session" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"csrf_hash" text NOT NULL,
	"principal_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_access_grant" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "support_access_grant_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"platform_principal_id" bigint NOT NULL,
	"created_by_principal_id" bigint NOT NULL,
	"master_fn" text NOT NULL,
	"company_fn" text,
	"reason" text NOT NULL,
	"ticket_reference" text NOT NULL,
	"mode" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"sensitive_restrictions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_principal_id" bigint,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_support_access_grant_mode" CHECK ("support_access_grant"."mode" in ('read_only', 'restricted_write', 'break_glass')),
	CONSTRAINT "ck_support_access_grant_window" CHECK ("support_access_grant"."valid_until" > "support_access_grant"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "platform_principal_id" bigint;--> statement-breakpoint
ALTER TABLE "platform_principal_role" ADD CONSTRAINT "platform_principal_role_principal_id_platform_principal_principal_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."platform_principal"("principal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_principal_role" ADD CONSTRAINT "platform_principal_role_platform_role_id_platform_role_platform_role_id_fk" FOREIGN KEY ("platform_role_id") REFERENCES "public"."platform_role"("platform_role_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_role_permission" ADD CONSTRAINT "platform_role_permission_platform_role_id_platform_role_platform_role_id_fk" FOREIGN KEY ("platform_role_id") REFERENCES "public"."platform_role"("platform_role_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_session" ADD CONSTRAINT "platform_session_principal_id_platform_principal_principal_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."platform_principal"("principal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access_grant" ADD CONSTRAINT "support_access_grant_platform_principal_id_platform_principal_principal_id_fk" FOREIGN KEY ("platform_principal_id") REFERENCES "public"."platform_principal"("principal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access_grant" ADD CONSTRAINT "support_access_grant_created_by_principal_id_platform_principal_principal_id_fk" FOREIGN KEY ("created_by_principal_id") REFERENCES "public"."platform_principal"("principal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access_grant" ADD CONSTRAINT "support_access_grant_master_fn_master_master_fn_fk" FOREIGN KEY ("master_fn") REFERENCES "public"."master"("master_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access_grant" ADD CONSTRAINT "support_access_grant_company_fn_company_company_fn_fk" FOREIGN KEY ("company_fn") REFERENCES "public"."company"("company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access_grant" ADD CONSTRAINT "support_access_grant_revoked_by_principal_id_platform_principal_principal_id_fk" FOREIGN KEY ("revoked_by_principal_id") REFERENCES "public"."platform_principal"("principal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_principal_key" ON "platform_principal" USING btree ("principal_key");--> statement-breakpoint
CREATE INDEX "idx_platform_principal_active" ON "platform_principal" USING btree ("is_active","principal_id");--> statement-breakpoint
CREATE INDEX "idx_platform_principal_role_role" ON "platform_principal_role" USING btree ("platform_role_id","principal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_role_code" ON "platform_role" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_platform_role_permission_key" ON "platform_role_permission" USING btree ("permission_key","platform_role_id");--> statement-breakpoint
CREATE INDEX "idx_platform_session_principal" ON "platform_session" USING btree ("principal_id","revoked_at");--> statement-breakpoint
CREATE INDEX "idx_platform_session_expiry" ON "platform_session" USING btree ("expires_at","revoked_at");--> statement-breakpoint
CREATE INDEX "idx_support_access_grant_principal_window" ON "support_access_grant" USING btree ("platform_principal_id","valid_from","valid_until","revoked_at");--> statement-breakpoint
CREATE INDEX "idx_support_access_grant_tenant_window" ON "support_access_grant" USING btree ("master_fn","company_fn","valid_from","valid_until");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_platform_principal_id_platform_principal_principal_id_fk" FOREIGN KEY ("platform_principal_id") REFERENCES "public"."platform_principal"("principal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_platform_activity" ON "audit_log" USING btree ("platform_principal_id","occurred_at","id");