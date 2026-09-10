CREATE TABLE "agent_knowledge_document" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_knowledge_document_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"corpus_key" text NOT NULL,
	"title" text NOT NULL,
	"document_id" bigint NOT NULL,
	"document_version_id" bigint NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"required_permission" text DEFAULT 'documents.knowledge.read' NOT NULL,
	"field_allowlist" jsonb DEFAULT '["title","content","effectiveFrom","effectiveTo","documentId","documentVersionId","documentVersionNo","sourceSha256"]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" bigint,
	"revocation_reason" text,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_agent_knowledge_corpus_key" CHECK ("agent_knowledge_document"."corpus_key" ~ '^[a-z][a-z0-9._-]{2,63}$'),
	CONSTRAINT "ck_agent_knowledge_title" CHECK (char_length("agent_knowledge_document"."title") between 1 and 160),
	CONSTRAINT "ck_agent_knowledge_effective_window" CHECK ("agent_knowledge_document"."effective_to" is null or "agent_knowledge_document"."effective_to" > "agent_knowledge_document"."effective_from"),
	CONSTRAINT "ck_agent_knowledge_permission" CHECK ("agent_knowledge_document"."required_permission" = 'documents.knowledge.read'),
	CONSTRAINT "ck_agent_knowledge_fields" CHECK (jsonb_typeof("agent_knowledge_document"."field_allowlist") = 'array'
      and jsonb_array_length("agent_knowledge_document"."field_allowlist") > 0),
	CONSTRAINT "ck_agent_knowledge_status" CHECK ("agent_knowledge_document"."status" in ('active', 'revoked', 'expired')),
	CONSTRAINT "ck_agent_knowledge_version" CHECK ("agent_knowledge_document"."version" > 0),
	CONSTRAINT "ck_agent_knowledge_revocation" CHECK ((
    ("agent_knowledge_document"."status" <> 'revoked' and "agent_knowledge_document"."revoked_at" is null
      and "agent_knowledge_document"."revoked_by_user_id" is null and "agent_knowledge_document"."revocation_reason" is null)
    or ("agent_knowledge_document"."status" = 'revoked' and "agent_knowledge_document"."revoked_at" is not null
      and "agent_knowledge_document"."revoked_by_user_id" is not null
      and char_length("agent_knowledge_document"."revocation_reason") between 3 and 1000)
  ))
);
--> statement-breakpoint
ALTER TABLE "agent_knowledge_document" ADD CONSTRAINT "agent_knowledge_document_document_id_managed_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."managed_document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_knowledge_document" ADD CONSTRAINT "agent_knowledge_document_document_version_id_document_version_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_knowledge_document" ADD CONSTRAINT "agent_knowledge_document_revoked_by_user_id_app_user_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_knowledge_document" ADD CONSTRAINT "agent_knowledge_document_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_knowledge_document" ADD CONSTRAINT "fk_agent_knowledge_company_master" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_knowledge_document" ADD CONSTRAINT "fk_agent_knowledge_creator_membership" FOREIGN KEY ("created_by_user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_knowledge_document" ADD CONSTRAINT "fk_agent_knowledge_revoker_membership" FOREIGN KEY ("revoked_by_user_id","company_fn") REFERENCES "public"."user_company"("user_id","company_fn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_knowledge_corpus_version" ON "agent_knowledge_document" USING btree ("master_fn","company_fn","corpus_key","document_version_id");--> statement-breakpoint
CREATE INDEX "idx_agent_knowledge_lookup" ON "agent_knowledge_document" USING btree ("master_fn","company_fn","corpus_key","status","effective_from","id");