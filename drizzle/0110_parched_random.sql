CREATE TABLE "agent_provider_config" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_provider_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"provider" text DEFAULT 'deterministic.zero_spend' NOT NULL,
	"model" text NOT NULL,
	"endpoint_url" text,
	"data_region" text DEFAULT 'tenant-local' NOT NULL,
	"data_policy" text DEFAULT 'tenant_no_training' NOT NULL,
	"credential_envelope" jsonb,
	"credential_label" text,
	"max_provider_calls" integer DEFAULT 1 NOT NULL,
	"max_retries" integer DEFAULT 0 NOT NULL,
	"max_duration_ms" integer DEFAULT 30000 NOT NULL,
	"max_input_chars" integer DEFAULT 16000 NOT NULL,
	"max_output_chars" integer DEFAULT 4000 NOT NULL,
	"max_cost_micros" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_agent_provider_config_provider" CHECK ("agent_provider_config"."provider" in ('deterministic.zero_spend', 'openai', 'google', 'openai_compatible')),
	CONSTRAINT "ck_agent_provider_config_model" CHECK (char_length("agent_provider_config"."model") between 1 and 160),
	CONSTRAINT "ck_agent_provider_config_region" CHECK (char_length("agent_provider_config"."data_region") between 2 and 80),
	CONSTRAINT "ck_agent_provider_config_policy" CHECK ("agent_provider_config"."data_policy" in ('tenant_only', 'tenant_no_training')),
	CONSTRAINT "ck_agent_provider_config_credential_label" CHECK ("agent_provider_config"."credential_label" is null or char_length("agent_provider_config"."credential_label") between 1 and 80),
	CONSTRAINT "ck_agent_provider_config_calls" CHECK ("agent_provider_config"."max_provider_calls" between 1 and 32),
	CONSTRAINT "ck_agent_provider_config_retries" CHECK ("agent_provider_config"."max_retries" >= 0 and "agent_provider_config"."max_retries" < "agent_provider_config"."max_provider_calls"),
	CONSTRAINT "ck_agent_provider_config_duration" CHECK ("agent_provider_config"."max_duration_ms" between 1000 and 120000),
	CONSTRAINT "ck_agent_provider_config_input" CHECK ("agent_provider_config"."max_input_chars" between 1 and 100000),
	CONSTRAINT "ck_agent_provider_config_output" CHECK ("agent_provider_config"."max_output_chars" between 1 and 100000),
	CONSTRAINT "ck_agent_provider_config_cost" CHECK ("agent_provider_config"."max_cost_micros" between 0 and 2000000000),
	CONSTRAINT "ck_agent_provider_config_version" CHECK ("agent_provider_config"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "agent_provider_config" ADD CONSTRAINT "agent_provider_config_updated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_provider_config" ADD CONSTRAINT "fk_agent_provider_config_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_provider_config" ADD CONSTRAINT "fk_agent_provider_config_updater_membership" FOREIGN KEY ("updated_by_user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_provider_config_company" ON "agent_provider_config" USING btree ("master_fn","company_fn");--> statement-breakpoint
CREATE INDEX "idx_agent_provider_config_provider" ON "agent_provider_config" USING btree ("master_fn","company_fn","provider","enabled");