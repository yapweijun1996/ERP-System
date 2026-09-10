CREATE TABLE "agent_execution_intent" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_execution_intent_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"agent_principal_id" bigint NOT NULL,
	"action_name" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"pack_key" text NOT NULL,
	"visibility" text NOT NULL,
	"locale" text NOT NULL,
	"filters" jsonb NOT NULL,
	"selection_digest" text NOT NULL,
	"resource_version_digest" text NOT NULL,
	"payload_digest" text NOT NULL,
	"reviewed_facts" jsonb NOT NULL,
	"intent_key_hash" text NOT NULL,
	"status" text DEFAULT 'prepared' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decision_by_user_id" bigint,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_agent_execution_intent_action" CHECK ("agent_execution_intent"."action_name" in ('receipt_pack.create')),
	CONSTRAINT "ck_agent_execution_intent_pack_key" CHECK ("agent_execution_intent"."pack_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_agent_execution_intent_visibility" CHECK ("agent_execution_intent"."visibility" in ('own', 'company')),
	CONSTRAINT "ck_agent_execution_intent_locale" CHECK ("agent_execution_intent"."locale" in ('en', 'ms', 'zh', 'ja', 'vi')),
	CONSTRAINT "ck_agent_execution_intent_json" CHECK (jsonb_typeof("agent_execution_intent"."filters") = 'object' and jsonb_typeof("agent_execution_intent"."reviewed_facts") = 'object'),
	CONSTRAINT "ck_agent_execution_intent_hashes" CHECK ("agent_execution_intent"."intent_key_hash" ~ '^[0-9a-f]{64}$'
      and "agent_execution_intent"."selection_digest" ~ '^[0-9a-f]{64}$'
      and "agent_execution_intent"."resource_version_digest" ~ '^[0-9a-f]{64}$'
      and "agent_execution_intent"."payload_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_agent_execution_intent_status" CHECK ("agent_execution_intent"."status" in ('prepared', 'approved', 'rejected', 'cancelled', 'expired', 'consumed')),
	CONSTRAINT "ck_agent_execution_intent_decision" CHECK ((
      "agent_execution_intent"."status" = 'prepared'
      and "agent_execution_intent"."decision_by_user_id" is null
      and "agent_execution_intent"."decision_reason" is null
      and "agent_execution_intent"."decided_at" is null
    )
    or (
      "agent_execution_intent"."status" = 'expired'
      and "agent_execution_intent"."decision_by_user_id" is null
      and "agent_execution_intent"."decision_reason" = 'expired'
      and "agent_execution_intent"."decided_at" is not null
    )
    or (
      "agent_execution_intent"."status" in ('approved', 'rejected', 'cancelled', 'consumed')
      and "agent_execution_intent"."decision_by_user_id" is not null
      and char_length("agent_execution_intent"."decision_reason") between 3 and 1000
      and "agent_execution_intent"."decided_at" is not null
    )),
	CONSTRAINT "ck_agent_execution_intent_expiry" CHECK ("agent_execution_intent"."expires_at" > "agent_execution_intent"."created_at"),
	CONSTRAINT "ck_agent_execution_intent_version" CHECK ("agent_execution_intent"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "agent_execution_intent" ADD CONSTRAINT "agent_execution_intent_decision_by_user_id_app_user_user_id_fk" FOREIGN KEY ("decision_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_execution_intent" ADD CONSTRAINT "fk_agent_execution_intent_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_execution_intent" ADD CONSTRAINT "fk_agent_execution_intent_principal_tenant" FOREIGN KEY ("agent_principal_id","master_fn","company_fn") REFERENCES "public"."agent_principal"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_execution_intent" ADD CONSTRAINT "fk_agent_execution_intent_actor_membership" FOREIGN KEY ("actor_user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_execution_intent" ADD CONSTRAINT "fk_agent_execution_intent_decision_membership" FOREIGN KEY ("decision_by_user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_execution_intent_key" ON "agent_execution_intent" USING btree ("master_fn","company_fn","agent_principal_id","intent_key_hash");--> statement-breakpoint
CREATE INDEX "idx_agent_execution_intent_actor" ON "agent_execution_intent" USING btree ("master_fn","company_fn","actor_user_id","status","id");--> statement-breakpoint
CREATE INDEX "idx_agent_execution_intent_expiry" ON "agent_execution_intent" USING btree ("master_fn","company_fn","status","expires_at","id");