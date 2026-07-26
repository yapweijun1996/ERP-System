CREATE TABLE "tax_evidence_pack" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_evidence_pack_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"pack_key" text NOT NULL,
	"version_no" integer NOT NULL,
	"snapshot_id" bigint NOT NULL,
	"report_job_id" bigint NOT NULL,
	"supersedes_pack_id" bigint,
	"source_sha256" text NOT NULL,
	"artifact_set_sha256" text NOT NULL,
	"difference_manifest" jsonb NOT NULL,
	"difference_manifest_sha256" text NOT NULL,
	"pack_sha256" text NOT NULL,
	"country_code" text NOT NULL,
	"statutory_minimum_years" integer NOT NULL,
	"company_retention_years" integer NOT NULL,
	"retention_until" timestamp with time zone NOT NULL,
	"correction_reason" text,
	"sealed_by_user_id" bigint NOT NULL,
	"sealed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_tax_evidence_pack_key" CHECK ("tax_evidence_pack"."pack_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_tax_evidence_pack_version" CHECK ("tax_evidence_pack"."version_no" > 0),
	CONSTRAINT "ck_tax_evidence_pack_hashes" CHECK (char_length("tax_evidence_pack"."source_sha256") = 64
      and "tax_evidence_pack"."source_sha256" ~ '^[0-9a-f]{64}$'
      and char_length("tax_evidence_pack"."artifact_set_sha256") = 64
      and "tax_evidence_pack"."artifact_set_sha256" ~ '^[0-9a-f]{64}$'
      and char_length("tax_evidence_pack"."difference_manifest_sha256") = 64
      and "tax_evidence_pack"."difference_manifest_sha256" ~ '^[0-9a-f]{64}$'
      and char_length("tax_evidence_pack"."pack_sha256") = 64
      and "tax_evidence_pack"."pack_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_tax_evidence_pack_country" CHECK ("tax_evidence_pack"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "ck_tax_evidence_pack_years" CHECK ("tax_evidence_pack"."statutory_minimum_years" between 1 and 20
      and "tax_evidence_pack"."company_retention_years" between "tax_evidence_pack"."statutory_minimum_years" and 50),
	CONSTRAINT "ck_tax_evidence_pack_correction" CHECK (("tax_evidence_pack"."version_no" = 1 and "tax_evidence_pack"."supersedes_pack_id" is null
        and "tax_evidence_pack"."correction_reason" is null)
      or ("tax_evidence_pack"."version_no" > 1 and "tax_evidence_pack"."supersedes_pack_id" is not null
        and char_length("tax_evidence_pack"."correction_reason") between 3 and 1000))
);
--> statement-breakpoint
CREATE TABLE "tax_evidence_pack_legal_hold_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_evidence_pack_legal_hold_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"pack_id" bigint NOT NULL,
	"event_key" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_tax_evidence_pack_hold_key" CHECK ("tax_evidence_pack_legal_hold_event"."event_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_tax_evidence_pack_hold_action" CHECK ("tax_evidence_pack_legal_hold_event"."action" in ('placed','released')),
	CONSTRAINT "ck_tax_evidence_pack_hold_reason" CHECK (char_length("tax_evidence_pack_legal_hold_event"."reason") between 3 and 1000)
);
--> statement-breakpoint
CREATE TABLE "tax_evidence_retention_policy" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_evidence_retention_policy_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"policy_key" text NOT NULL,
	"version_no" integer NOT NULL,
	"effective_from" date NOT NULL,
	"country_code" text NOT NULL,
	"statutory_minimum_years" integer NOT NULL,
	"company_retention_years" integer NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_tax_evidence_retention_policy_key" CHECK ("tax_evidence_retention_policy"."policy_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_tax_evidence_retention_policy_version" CHECK ("tax_evidence_retention_policy"."version_no" > 0),
	CONSTRAINT "ck_tax_evidence_retention_policy_country" CHECK ("tax_evidence_retention_policy"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "ck_tax_evidence_retention_policy_years" CHECK ("tax_evidence_retention_policy"."statutory_minimum_years" between 1 and 20
      and "tax_evidence_retention_policy"."company_retention_years" between "tax_evidence_retention_policy"."statutory_minimum_years" and 50)
);
--> statement-breakpoint
ALTER TABLE "tax_evidence_pack" ADD CONSTRAINT "tax_evidence_pack_snapshot_id_tax_evidence_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."tax_evidence_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_pack" ADD CONSTRAINT "tax_evidence_pack_report_job_id_tax_evidence_report_job_id_fk" FOREIGN KEY ("report_job_id") REFERENCES "public"."tax_evidence_report_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_pack" ADD CONSTRAINT "tax_evidence_pack_supersedes_pack_id_tax_evidence_pack_id_fk" FOREIGN KEY ("supersedes_pack_id") REFERENCES "public"."tax_evidence_pack"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_pack" ADD CONSTRAINT "tax_evidence_pack_sealed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("sealed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_pack_legal_hold_event" ADD CONSTRAINT "tax_evidence_pack_legal_hold_event_pack_id_tax_evidence_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."tax_evidence_pack"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_pack_legal_hold_event" ADD CONSTRAINT "tax_evidence_pack_legal_hold_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_evidence_retention_policy" ADD CONSTRAINT "tax_evidence_retention_policy_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_pack_version" ON "tax_evidence_pack" USING btree ("master_fn","company_fn","pack_key","version_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_pack_job" ON "tax_evidence_pack" USING btree ("master_fn","company_fn","report_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_pack_supersedes" ON "tax_evidence_pack" USING btree ("master_fn","company_fn","supersedes_pack_id");--> statement-breakpoint
CREATE INDEX "idx_tax_evidence_pack_chain" ON "tax_evidence_pack" USING btree ("master_fn","company_fn","pack_key","version_no","id");--> statement-breakpoint
CREATE INDEX "idx_tax_evidence_pack_retention" ON "tax_evidence_pack" USING btree ("master_fn","company_fn","retention_until","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_pack_hold_key" ON "tax_evidence_pack_legal_hold_event" USING btree ("master_fn","company_fn","pack_id","event_key");--> statement-breakpoint
CREATE INDEX "idx_tax_evidence_pack_hold_state" ON "tax_evidence_pack_legal_hold_event" USING btree ("master_fn","company_fn","pack_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_retention_policy_key" ON "tax_evidence_retention_policy" USING btree ("master_fn","company_fn","policy_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_evidence_retention_policy_version" ON "tax_evidence_retention_policy" USING btree ("master_fn","company_fn","version_no");--> statement-breakpoint
CREATE INDEX "idx_tax_evidence_retention_policy_effective" ON "tax_evidence_retention_policy" USING btree ("master_fn","company_fn","effective_from","version_no");
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_tax_evidence_retention_policy_immutable ON tax_evidence_retention_policy;
--> statement-breakpoint
CREATE TRIGGER trg_tax_evidence_retention_policy_immutable
BEFORE UPDATE OR DELETE ON tax_evidence_retention_policy
FOR EACH ROW EXECUTE FUNCTION prevent_tax_evidence_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_tax_evidence_pack_immutable ON tax_evidence_pack;
--> statement-breakpoint
CREATE TRIGGER trg_tax_evidence_pack_immutable
BEFORE UPDATE OR DELETE ON tax_evidence_pack
FOR EACH ROW EXECUTE FUNCTION prevent_tax_evidence_fact_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_tax_evidence_pack_hold_immutable ON tax_evidence_pack_legal_hold_event;
--> statement-breakpoint
CREATE TRIGGER trg_tax_evidence_pack_hold_immutable
BEFORE UPDATE OR DELETE ON tax_evidence_pack_legal_hold_event
FOR EACH ROW EXECUTE FUNCTION prevent_tax_evidence_fact_change();
