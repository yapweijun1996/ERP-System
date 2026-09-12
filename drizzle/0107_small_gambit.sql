CREATE TABLE "agent_credential" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_credential_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"agent_principal_id" bigint NOT NULL,
	"credential_key" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_hint" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" bigint,
	"revocation_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_agent_credential_status" CHECK ("agent_credential"."status" in ('active', 'revoked')),
	CONSTRAINT "ck_agent_credential_key" CHECK (char_length("agent_credential"."credential_key") between 8 and 160),
	CONSTRAINT "ck_agent_credential_hash" CHECK ("agent_credential"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_agent_credential_hint" CHECK (char_length("agent_credential"."token_hint") between 4 and 32),
	CONSTRAINT "ck_agent_credential_window" CHECK ("agent_credential"."valid_until" is null or "agent_credential"."valid_until" > "agent_credential"."valid_from"),
	CONSTRAINT "ck_agent_credential_revocation" CHECK ((
    ("agent_credential"."revoked_at" is null and "agent_credential"."revoked_by_user_id" is null and "agent_credential"."revocation_reason" is null)
    or ("agent_credential"."revoked_at" is not null and "agent_credential"."revoked_by_user_id" is not null and "agent_credential"."revocation_reason" is not null)
  )),
	CONSTRAINT "ck_agent_credential_version" CHECK ("agent_credential"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "agent_credential" ADD CONSTRAINT "agent_credential_revoked_by_user_id_app_user_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_credential" ADD CONSTRAINT "agent_credential_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_credential" ADD CONSTRAINT "fk_agent_credential_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_credential" ADD CONSTRAINT "fk_agent_credential_principal_tenant" FOREIGN KEY ("agent_principal_id","master_fn","company_fn") REFERENCES "public"."agent_principal"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_credential" ADD CONSTRAINT "fk_agent_credential_creator_membership" FOREIGN KEY ("created_by_user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_credential" ADD CONSTRAINT "fk_agent_credential_revoker_membership" FOREIGN KEY ("revoked_by_user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_credential_key" ON "agent_credential" USING btree ("master_fn","company_fn","agent_principal_id","credential_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_credential_hash" ON "agent_credential" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_agent_credential_principal" ON "agent_credential" USING btree ("master_fn","company_fn","agent_principal_id","status","id");