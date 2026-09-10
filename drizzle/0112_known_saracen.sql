ALTER TABLE "agent_execution_intent" ADD CONSTRAINT "uq_agent_execution_intent_tenant_id" UNIQUE("id","master_fn","company_fn");--> statement-breakpoint
CREATE TABLE "agent_workflow_run" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_workflow_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"workflow_key" text NOT NULL,
	"agent_principal_id" bigint NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"intent_id" bigint NOT NULL,
	"trigger_key_hash" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"lease_expires_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"current_step_key" text,
	"checkpoint" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_ref" jsonb,
	"last_error" text,
	"pause_requested_at" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_agent_workflow_run_key" CHECK ("agent_workflow_run"."workflow_key" in ('receipt_pack.create')),
	CONSTRAINT "ck_agent_workflow_run_state" CHECK ("agent_workflow_run"."state" in (
    'queued','waiting_approval','paused','running','succeeded','failed','cancelled'
  )),
	CONSTRAINT "ck_agent_workflow_run_hash" CHECK ("agent_workflow_run"."trigger_key_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_agent_workflow_run_version" CHECK ("agent_workflow_run"."version" > 0),
	CONSTRAINT "ck_agent_workflow_run_attempts" CHECK ("agent_workflow_run"."attempts" >= 0 and "agent_workflow_run"."attempts" <= "agent_workflow_run"."max_attempts"),
	CONSTRAINT "ck_agent_workflow_run_max_attempts" CHECK ("agent_workflow_run"."max_attempts" between 1 and 10),
	CONSTRAINT "ck_agent_workflow_run_json" CHECK (jsonb_typeof("agent_workflow_run"."checkpoint") = 'object'),
	CONSTRAINT "ck_agent_workflow_run_lock" CHECK ((
    ("agent_workflow_run"."locked_at" is null and "agent_workflow_run"."locked_by" is null and "agent_workflow_run"."lease_expires_at" is null)
    or ("agent_workflow_run"."locked_at" is not null and "agent_workflow_run"."locked_by" is not null and "agent_workflow_run"."lease_expires_at" is not null)
  )),
	CONSTRAINT "ck_agent_workflow_run_terminal" CHECK ((
    "agent_workflow_run"."state" in ('succeeded','failed','cancelled')
      and "agent_workflow_run"."completed_at" is not null
    or "agent_workflow_run"."state" not in ('succeeded','failed','cancelled')
  ))
);
--> statement-breakpoint
CREATE TABLE "agent_workflow_step" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_workflow_step_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"run_id" bigint NOT NULL,
	"step_key" text NOT NULL,
	"sequence_no" integer NOT NULL,
	"effect_key_hash" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"lease_expires_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"checkpoint" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_ref" jsonb,
	"last_error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_agent_workflow_step_key" CHECK ("agent_workflow_step"."step_key" in ('approval','execute','verify')),
	CONSTRAINT "ck_agent_workflow_step_sequence" CHECK ("agent_workflow_step"."sequence_no" between 1 and 3),
	CONSTRAINT "ck_agent_workflow_step_state" CHECK ("agent_workflow_step"."state" in (
    'queued','waiting_approval','paused','running','succeeded','failed','cancelled'
  )),
	CONSTRAINT "ck_agent_workflow_step_hash" CHECK ("agent_workflow_step"."effect_key_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_agent_workflow_step_version" CHECK ("agent_workflow_step"."version" > 0),
	CONSTRAINT "ck_agent_workflow_step_attempts" CHECK ("agent_workflow_step"."attempts" >= 0 and "agent_workflow_step"."attempts" <= "agent_workflow_step"."max_attempts"),
	CONSTRAINT "ck_agent_workflow_step_max_attempts" CHECK ("agent_workflow_step"."max_attempts" between 1 and 10),
	CONSTRAINT "ck_agent_workflow_step_json" CHECK (jsonb_typeof("agent_workflow_step"."checkpoint") = 'object'),
	CONSTRAINT "ck_agent_workflow_step_lock" CHECK ((
    ("agent_workflow_step"."locked_at" is null and "agent_workflow_step"."locked_by" is null and "agent_workflow_step"."lease_expires_at" is null)
    or ("agent_workflow_step"."locked_at" is not null and "agent_workflow_step"."locked_by" is not null and "agent_workflow_step"."lease_expires_at" is not null)
  ))
);
--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "uq_agent_workflow_run_tenant_id" UNIQUE("id","master_fn","company_fn");--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "agent_workflow_run_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "fk_agent_workflow_run_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "fk_agent_workflow_run_principal_tenant" FOREIGN KEY ("agent_principal_id","master_fn","company_fn") REFERENCES "public"."agent_principal"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "fk_agent_workflow_run_intent_tenant" FOREIGN KEY ("intent_id","master_fn","company_fn") REFERENCES "public"."agent_execution_intent"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_run" ADD CONSTRAINT "fk_agent_workflow_run_actor_membership" FOREIGN KEY ("actor_user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_step" ADD CONSTRAINT "fk_agent_workflow_step_run_tenant" FOREIGN KEY ("run_id","master_fn","company_fn") REFERENCES "public"."agent_workflow_run"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_workflow_run_trigger" ON "agent_workflow_run" USING btree ("master_fn","company_fn","agent_principal_id","trigger_key_hash");--> statement-breakpoint
CREATE INDEX "idx_agent_workflow_run_queue" ON "agent_workflow_run" USING btree ("state","available_at","lease_expires_at","id");--> statement-breakpoint
CREATE INDEX "idx_agent_workflow_run_actor" ON "agent_workflow_run" USING btree ("master_fn","company_fn","actor_user_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_workflow_step_key" ON "agent_workflow_step" USING btree ("master_fn","company_fn","run_id","step_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_workflow_step_effect" ON "agent_workflow_step" USING btree ("master_fn","company_fn","run_id","effect_key_hash");--> statement-breakpoint
CREATE INDEX "idx_agent_workflow_step_queue" ON "agent_workflow_step" USING btree ("master_fn","company_fn","state","available_at","id");--> statement-breakpoint
