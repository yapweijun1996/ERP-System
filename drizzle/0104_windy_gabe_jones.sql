CREATE TABLE "agent_grant" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_grant_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"agent_principal_id" bigint NOT NULL,
	"action_name" text NOT NULL,
	"permission_key" text NOT NULL,
	"resource_key" text NOT NULL,
	"scope" text NOT NULL,
	"target_type" text DEFAULT 'none' NOT NULL,
	"target_id" text DEFAULT '' NOT NULL,
	"field_allowlist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amount_limit" numeric(18, 4),
	"amount_currency" text,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" bigint,
	"revocation_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_agent_grant_scope" CHECK ("agent_grant"."scope" in ('self', 'team', 'department', 'company')),
	CONSTRAINT "ck_agent_grant_target_type" CHECK ("agent_grant"."target_type" in ('none', 'company', 'branch', 'department', 'team', 'employee', 'region', 'business_unit', 'legal_entity', 'cost_center')),
	CONSTRAINT "ck_agent_grant_target" CHECK (("agent_grant"."target_type" = 'none' and "agent_grant"."target_id" = '') or ("agent_grant"."target_type" <> 'none' and char_length("agent_grant"."target_id") > 0)),
	CONSTRAINT "ck_agent_grant_fields" CHECK (jsonb_array_length("agent_grant"."field_allowlist") > 0),
	CONSTRAINT "ck_agent_grant_amount" CHECK ("agent_grant"."amount_limit" is null or "agent_grant"."amount_limit" >= 0),
	CONSTRAINT "ck_agent_grant_amount_currency" CHECK (("agent_grant"."amount_limit" is null and "agent_grant"."amount_currency" is null)
      or ("agent_grant"."amount_limit" is not null and "agent_grant"."amount_currency" is not null)),
	CONSTRAINT "ck_agent_grant_window" CHECK ("agent_grant"."valid_until" is null or "agent_grant"."valid_until" > "agent_grant"."valid_from"),
	CONSTRAINT "ck_agent_grant_revocation" CHECK (("agent_grant"."revoked_at" is null and "agent_grant"."revoked_by_user_id" is null and "agent_grant"."revocation_reason" is null)
      or ("agent_grant"."revoked_at" is not null and "agent_grant"."revoked_by_user_id" is not null and "agent_grant"."revocation_reason" is not null)),
	CONSTRAINT "ck_agent_grant_version" CHECK ("agent_grant"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "agent_principal" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_principal_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"principal_key" text NOT NULL,
	"display_name" text NOT NULL,
	"kind" text DEFAULT 'delegated_agent' NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"owner_user_id" bigint NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"disabled_at" timestamp with time zone,
	"disabled_by_user_id" bigint,
	"disabled_reason" text,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" bigint,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_agent_principal_tenant_id" UNIQUE("id","master_fn","company_fn"),
	CONSTRAINT "ck_agent_principal_kind" CHECK ("agent_principal"."kind" in ('delegated_agent', 'service_automation')),
	CONSTRAINT "ck_agent_principal_status" CHECK ("agent_principal"."status" in ('active', 'paused', 'revoked', 'disabled')),
	CONSTRAINT "ck_agent_principal_version" CHECK ("agent_principal"."version" > 0),
	CONSTRAINT "ck_agent_principal_key" CHECK (char_length("agent_principal"."principal_key") between 3 and 128),
	CONSTRAINT "ck_agent_principal_display_name" CHECK (char_length("agent_principal"."display_name") between 1 and 160),
	CONSTRAINT "ck_agent_principal_revocation" CHECK (("agent_principal"."revoked_at" is null and "agent_principal"."revoked_by_user_id" is null and "agent_principal"."revocation_reason" is null)
      or ("agent_principal"."revoked_at" is not null and "agent_principal"."revoked_by_user_id" is not null and "agent_principal"."revocation_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "app_user" DROP CONSTRAINT "ck_app_user_platform_actor_login";--> statement-breakpoint
ALTER TABLE "app_user" DROP CONSTRAINT "ck_app_user_identity_kind";--> statement-breakpoint
ALTER TABLE "agent_grant" ADD CONSTRAINT "agent_grant_amount_currency_currency_code_fk" FOREIGN KEY ("amount_currency") REFERENCES "public"."currency"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_grant" ADD CONSTRAINT "agent_grant_revoked_by_user_id_app_user_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_grant" ADD CONSTRAINT "agent_grant_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_grant" ADD CONSTRAINT "fk_agent_grant_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_grant" ADD CONSTRAINT "fk_agent_grant_principal_tenant" FOREIGN KEY ("agent_principal_id","master_fn","company_fn") REFERENCES "public"."agent_principal"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_grant" ADD CONSTRAINT "fk_agent_grant_creator_membership" FOREIGN KEY ("created_by_user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_principal" ADD CONSTRAINT "agent_principal_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_principal" ADD CONSTRAINT "agent_principal_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_principal" ADD CONSTRAINT "agent_principal_disabled_by_user_id_app_user_user_id_fk" FOREIGN KEY ("disabled_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_principal" ADD CONSTRAINT "agent_principal_revoked_by_user_id_app_user_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_principal" ADD CONSTRAINT "fk_agent_principal_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_principal" ADD CONSTRAINT "fk_agent_principal_owner_membership" FOREIGN KEY ("owner_user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_grant_lookup" ON "agent_grant" USING btree ("master_fn","company_fn","agent_principal_id","action_name","valid_from","valid_until");--> statement-breakpoint
CREATE INDEX "idx_agent_grant_permission" ON "agent_grant" USING btree ("master_fn","company_fn","permission_key","resource_key","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_principal_key" ON "agent_principal" USING btree ("master_fn","company_fn","principal_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_principal_actor_user" ON "agent_principal" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_agent_principal_owner" ON "agent_principal" USING btree ("master_fn","company_fn","owner_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_agent_principal_status" ON "agent_principal" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "ck_app_user_non_human_login" CHECK ("app_user"."identity_kind" = 'human' or "app_user"."login_enabled" = false);--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "ck_app_user_identity_kind" CHECK ("app_user"."identity_kind" in ('human', 'platform_actor', 'agent', 'service_automation'));