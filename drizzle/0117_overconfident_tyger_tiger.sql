CREATE TABLE "product_case_evidence" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_case_evidence_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"case_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"visibility" text NOT NULL,
	"summary" text NOT NULL,
	"content_digest" text NOT NULL,
	"idempotency_hash" text,
	"actor_user_id" bigint,
	"agent_principal_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_product_case_evidence_tenant_case_id" UNIQUE("id","master_fn","company_fn","case_id"),
	CONSTRAINT "ck_product_case_evidence_kind" CHECK ("product_case_evidence"."kind" in ('agent_observation', 'agent_reproduction', 'human_reproduction', 'post_release_verification')),
	CONSTRAINT "ck_product_case_evidence_visibility" CHECK ("product_case_evidence"."visibility" in ('reporter', 'internal')),
	CONSTRAINT "ck_product_case_evidence_summary" CHECK (char_length("product_case_evidence"."summary") between 1 and 1000),
	CONSTRAINT "ck_product_case_evidence_digest" CHECK ("product_case_evidence"."content_digest" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "ck_product_case_evidence_key" CHECK ("product_case_evidence"."idempotency_hash" is null or "product_case_evidence"."idempotency_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "ck_product_case_evidence_actor" CHECK ((
    ("product_case_evidence"."kind" in ('agent_observation', 'agent_reproduction') and "product_case_evidence"."agent_principal_id" is not null and "product_case_evidence"."idempotency_hash" is not null and "product_case_evidence"."visibility" = 'reporter')
    or ("product_case_evidence"."kind" in ('human_reproduction', 'post_release_verification') and "product_case_evidence"."agent_principal_id" is null and "product_case_evidence"."actor_user_id" is not null and "product_case_evidence"."idempotency_hash" is null and "product_case_evidence"."visibility" = 'internal')
  ))
);
--> statement-breakpoint
ALTER TABLE "product_case" DROP CONSTRAINT "ck_product_case_status";--> statement-breakpoint
ALTER TABLE "product_case_event" DROP CONSTRAINT "ck_product_case_event_type";--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "assigned_user_id" bigint;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "duplicate_of_case_id" bigint;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "task_reference" text;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "task_linked_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "release_revision" text;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "release_proof_digest" text;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "released_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "verified_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "resolution_code" text;--> statement-breakpoint
ALTER TABLE "product_case" ADD COLUMN "outcome_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_case_event" ADD COLUMN "evidence_id" bigint;--> statement-breakpoint
ALTER TABLE "product_case_event" ADD COLUMN "task_reference" text;--> statement-breakpoint
ALTER TABLE "product_case_event" ADD COLUMN "release_revision" text;--> statement-breakpoint
ALTER TABLE "product_case_event" ADD COLUMN "release_proof_digest" text;--> statement-breakpoint
ALTER TABLE "product_case_event" ADD COLUMN "verification_result" text;--> statement-breakpoint
ALTER TABLE "product_case_event" ADD COLUMN "resolution_code" text;--> statement-breakpoint
ALTER TABLE "product_case_event" ADD COLUMN "duplicate_of_case_id" bigint;--> statement-breakpoint
ALTER TABLE "product_case_evidence" ADD CONSTRAINT "product_case_evidence_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case_evidence" ADD CONSTRAINT "fk_product_case_evidence_case" FOREIGN KEY ("case_id","master_fn","company_fn") REFERENCES "public"."product_case"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case_evidence" ADD CONSTRAINT "fk_product_case_evidence_agent" FOREIGN KEY ("agent_principal_id","master_fn","company_fn") REFERENCES "public"."agent_principal"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_case_evidence_agent_key" ON "product_case_evidence" USING btree ("master_fn","company_fn","case_id","agent_principal_id","idempotency_hash");--> statement-breakpoint
CREATE INDEX "idx_product_case_evidence_case" ON "product_case_evidence" USING btree ("master_fn","company_fn","case_id","id");--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "product_case_assigned_user_id_app_user_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "product_case_task_linked_by_user_id_app_user_user_id_fk" FOREIGN KEY ("task_linked_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "product_case_released_by_user_id_app_user_user_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "product_case_verified_by_user_id_app_user_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "fk_product_case_duplicate_same_company" FOREIGN KEY ("duplicate_of_case_id","master_fn","company_fn") REFERENCES "public"."product_case"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case_event" ADD CONSTRAINT "fk_product_case_event_evidence" FOREIGN KEY ("evidence_id","master_fn","company_fn","case_id") REFERENCES "public"."product_case_evidence"("id","master_fn","company_fn","case_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_case_event" ADD CONSTRAINT "fk_product_case_event_duplicate_same_company" FOREIGN KEY ("duplicate_of_case_id","master_fn","company_fn") REFERENCES "public"."product_case"("id","master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_case_duplicate" ON "product_case" USING btree ("master_fn","company_fn","duplicate_of_case_id");--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "ck_product_case_category" CHECK ("product_case"."category" is null or "product_case"."category" in ('defect', 'usability', 'improvement'));--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "ck_product_case_resolution_code" CHECK ("product_case"."resolution_code" is null or "product_case"."resolution_code" in ('fixed', 'duplicate', 'not_reproducible', 'declined', 'answered'));--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "ck_product_case_duplicate_not_self" CHECK ("product_case"."duplicate_of_case_id" is null or "product_case"."duplicate_of_case_id" <> "product_case"."id");--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "ck_product_case_task_reference" CHECK ("product_case"."task_reference" is null or char_length("product_case"."task_reference") between 4 and 160);--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "ck_product_case_release_revision" CHECK ("product_case"."release_revision" is null or "product_case"."release_revision" ~ '^[a-f0-9]{40}$');--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "ck_product_case_release_proof" CHECK ("product_case"."release_proof_digest" is null or "product_case"."release_proof_digest" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "ck_product_case_release_pair" CHECK (("product_case"."release_revision" is null) = ("product_case"."release_proof_digest" is null));--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "ck_product_case_released" CHECK ("product_case"."status" not in ('released', 'verified') or ("product_case"."release_revision" is not null and "product_case"."release_proof_digest" is not null and "product_case"."released_by_user_id" is not null and "product_case"."released_at" is not null));--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "ck_product_case_verified" CHECK ("product_case"."status" <> 'verified' or ("product_case"."verified_by_user_id" is not null and "product_case"."verified_at" is not null));--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "ck_product_case_verifier_pair" CHECK (("product_case"."verified_by_user_id" is null) = ("product_case"."verified_at" is null));--> statement-breakpoint
ALTER TABLE "product_case" ADD CONSTRAINT "ck_product_case_status" CHECK ("product_case"."status" in ('submitted', 'triaged', 'needs_info', 'accepted', 'in_progress', 'resolved', 'released', 'verified', 'closed'));--> statement-breakpoint
ALTER TABLE "product_case_event" ADD CONSTRAINT "ck_product_case_event_verification" CHECK ("product_case_event"."verification_result" is null or "product_case_event"."verification_result" in ('passed', 'failed'));--> statement-breakpoint
ALTER TABLE "product_case_event" ADD CONSTRAINT "ck_product_case_event_evidence" CHECK ("product_case_event"."event_type" not in ('evidence_added', 'verified', 'verification_failed') or "product_case_event"."evidence_id" is not null);--> statement-breakpoint
ALTER TABLE "product_case_event" ADD CONSTRAINT "ck_product_case_event_release" CHECK ("product_case_event"."event_type" <> 'released' or ("product_case_event"."release_revision" is not null and "product_case_event"."release_revision" ~ '^[a-f0-9]{40}$' and "product_case_event"."release_proof_digest" is not null and "product_case_event"."release_proof_digest" ~ '^[a-f0-9]{64}$'));--> statement-breakpoint
ALTER TABLE "product_case_event" ADD CONSTRAINT "ck_product_case_event_type" CHECK ("product_case_event"."event_type" in ('submitted', 'transitioned', 'evidence_added', 'triaged', 'task_linked', 'released', 'verified', 'verification_failed'));