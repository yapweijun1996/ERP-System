CREATE TABLE "platform_break_glass_window" (
	"window_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "platform_break_glass_window_window_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"access_id" bigint NOT NULL,
	"platform_principal_id" bigint NOT NULL,
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"reason" text NOT NULL,
	"ticket_reference" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_principal_tenant_actor" (
	"platform_principal_id" bigint NOT NULL,
	"master_fn" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_principal_tenant_actor_platform_principal_id_master_fn_pk" PRIMARY KEY("platform_principal_id","master_fn")
);
--> statement-breakpoint
CREATE TABLE "platform_tenant_access_session" (
	"access_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "platform_tenant_access_session_access_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"platform_session_hash" text NOT NULL,
	"platform_principal_id" bigint NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"mode" text DEFAULT 'platform_admin' NOT NULL,
	"reason" text NOT NULL,
	"ticket_reference" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_platform_tenant_access_mode" CHECK ("platform_tenant_access_session"."mode" = 'platform_admin')
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "identity_kind" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "login_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_break_glass_window" ADD CONSTRAINT "platform_break_glass_window_access_id_platform_tenant_access_session_access_id_fk" FOREIGN KEY ("access_id") REFERENCES "public"."platform_tenant_access_session"("access_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_break_glass_window" ADD CONSTRAINT "platform_break_glass_window_platform_principal_id_platform_principal_principal_id_fk" FOREIGN KEY ("platform_principal_id") REFERENCES "public"."platform_principal"("principal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_break_glass_window" ADD CONSTRAINT "platform_break_glass_window_master_fn_master_master_fn_fk" FOREIGN KEY ("master_fn") REFERENCES "public"."master"("master_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_break_glass_window" ADD CONSTRAINT "platform_break_glass_window_company_fn_company_company_fn_fk" FOREIGN KEY ("company_fn") REFERENCES "public"."company"("company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_break_glass_window" ADD CONSTRAINT "fk_platform_break_glass_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_principal_tenant_actor" ADD CONSTRAINT "platform_principal_tenant_actor_platform_principal_id_platform_principal_principal_id_fk" FOREIGN KEY ("platform_principal_id") REFERENCES "public"."platform_principal"("principal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_principal_tenant_actor" ADD CONSTRAINT "platform_principal_tenant_actor_master_fn_master_master_fn_fk" FOREIGN KEY ("master_fn") REFERENCES "public"."master"("master_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_principal_tenant_actor" ADD CONSTRAINT "platform_principal_tenant_actor_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_tenant_access_session" ADD CONSTRAINT "platform_tenant_access_session_platform_session_hash_platform_session_token_hash_fk" FOREIGN KEY ("platform_session_hash") REFERENCES "public"."platform_session"("token_hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_tenant_access_session" ADD CONSTRAINT "platform_tenant_access_session_platform_principal_id_platform_principal_principal_id_fk" FOREIGN KEY ("platform_principal_id") REFERENCES "public"."platform_principal"("principal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_tenant_access_session" ADD CONSTRAINT "platform_tenant_access_session_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_tenant_access_session" ADD CONSTRAINT "platform_tenant_access_session_master_fn_master_master_fn_fk" FOREIGN KEY ("master_fn") REFERENCES "public"."master"("master_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_tenant_access_session" ADD CONSTRAINT "platform_tenant_access_session_company_fn_company_company_fn_fk" FOREIGN KEY ("company_fn") REFERENCES "public"."company"("company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_tenant_access_session" ADD CONSTRAINT "fk_platform_tenant_access_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_break_glass_active_access" ON "platform_break_glass_window" USING btree ("access_id") WHERE "platform_break_glass_window"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "idx_platform_break_glass_scope_window" ON "platform_break_glass_window" USING btree ("master_fn","company_fn","expires_at","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_principal_tenant_actor_user" ON "platform_principal_tenant_actor" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_platform_principal_tenant_actor_master" ON "platform_principal_tenant_actor" USING btree ("master_fn","platform_principal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_tenant_access_active_session" ON "platform_tenant_access_session" USING btree ("platform_session_hash") WHERE "platform_tenant_access_session"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "idx_platform_tenant_access_principal_window" ON "platform_tenant_access_session" USING btree ("platform_principal_id","expires_at","revoked_at");--> statement-breakpoint
CREATE INDEX "idx_platform_tenant_access_scope_window" ON "platform_tenant_access_session" USING btree ("master_fn","company_fn","expires_at","revoked_at");--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "ck_app_user_identity_kind" CHECK ("app_user"."identity_kind" in ('human', 'platform_actor'));--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "ck_app_user_platform_actor_login" CHECK ("app_user"."identity_kind" <> 'platform_actor' or "app_user"."login_enabled" = false);
--> statement-breakpoint
INSERT INTO "platform_role_permission" ("platform_role_id", "permission_key", "created_at", "updated_at")
SELECT "platform_role_id", 'platform.tenant_access.manage', now(), now()
FROM "platform_role"
WHERE "code" = 'platform_superadmin'
ON CONFLICT DO NOTHING;
