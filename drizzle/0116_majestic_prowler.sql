CREATE TABLE "product_case" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_case_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"case_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"route_key" text,
	"reference_id" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"resolution" text,
	"version" integer DEFAULT 1 NOT NULL,
	"submitted_by_agent_id" bigint NOT NULL,
	"accountable_owner_user_id" bigint NOT NULL,
	"idempotency_hash" text NOT NULL,
	"payload_digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_product_case_tenant_id" UNIQUE("id","master_fn","company_fn"),
	CONSTRAINT "ck_product_case_type" CHECK ("product_case"."case_type" in ('feedback', 'ticket')),
	CONSTRAINT "ck_product_case_status" CHECK ("product_case"."status" in ('submitted', 'triaged', 'in_progress', 'resolved', 'closed')),
	CONSTRAINT "ck_product_case_version" CHECK ("product_case"."version" > 0),
	CONSTRAINT "ck_product_case_title" CHECK (char_length("product_case"."title") between 1 and 160),
	CONSTRAINT "ck_product_case_description" CHECK (char_length("product_case"."description") between 1 and 4000),
	CONSTRAINT "ck_product_case_hash" CHECK ("product_case"."idempotency_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "ck_product_case_digest" CHECK ("product_case"."payload_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "product_case_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_case_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"case_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_user_id" bigint,
	"agent_principal_id" bigint,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_product_case_event_type" CHECK ("product_case_event"."event_type" in ('submitted', 'transitioned')),
	CONSTRAINT "ck_product_case_event_note" CHECK ("product_case_event"."note" is null or char_length("product_case_event"."note") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "product_case_accountable_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("accountable_owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "fk_product_case_company" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "fk_product_case_agent" FOREIGN KEY ("submitted_by_agent_id","master_fn","company_fn") REFERENCES "public"."agent_principal"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case_event" ADD CONSTRAINT "product_case_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case_event" ADD CONSTRAINT "fk_product_case_event_case" FOREIGN KEY ("case_id","master_fn","company_fn") REFERENCES "public"."product_case"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_case_agent_key" ON "product_case" USING btree ("master_fn","company_fn","submitted_by_agent_id","idempotency_hash");--> statement-breakpoint
CREATE INDEX "idx_product_case_queue" ON "product_case" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
CREATE INDEX "idx_product_case_agent" ON "product_case" USING btree ("master_fn","company_fn","submitted_by_agent_id","id");--> statement-breakpoint
CREATE INDEX "idx_product_case_event_case" ON "product_case_event" USING btree ("master_fn","company_fn","case_id","id");