CREATE TABLE "document_blob" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_blob_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"version_id" bigint NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_file_location" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_file_location_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"version_id" bigint NOT NULL,
	"relative_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_file_location_relative" CHECK (char_length("document_file_location"."relative_path") between 1 and 500
      and "document_file_location"."relative_path" !~ '(^/|(^|/)\.\.(/|$))')
);
--> statement-breakpoint
CREATE TABLE "document_version" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"document_id" bigint NOT NULL,
	"version_no" integer NOT NULL,
	"sha256" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_backend" text NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_version_no" CHECK ("document_version"."version_no" > 0),
	CONSTRAINT "ck_document_version_sha256" CHECK (char_length("document_version"."sha256") = 64 and "document_version"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_document_version_mime" CHECK (char_length("document_version"."mime_type") between 3 and 160),
	CONSTRAINT "ck_document_version_size" CHECK ("document_version"."size_bytes" > 0),
	CONSTRAINT "ck_document_version_backend" CHECK ("document_version"."storage_backend" in ('database', 'filesystem'))
);
--> statement-breakpoint
CREATE TABLE "managed_document" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "managed_document_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"document_key" text NOT NULL,
	"purpose" text NOT NULL,
	"owner_user_id" bigint NOT NULL,
	"original_file_name" text NOT NULL,
	"current_version_no" integer DEFAULT 1 NOT NULL,
	"retention_until" timestamp with time zone NOT NULL,
	"legal_hold" boolean DEFAULT false NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_managed_document_purpose" CHECK ("managed_document"."purpose" in ('receipt', 'leave_evidence', 'tax_evidence', 'other')),
	CONSTRAINT "ck_managed_document_version" CHECK ("managed_document"."current_version_no" > 0),
	CONSTRAINT "ck_managed_document_file_name" CHECK (char_length("managed_document"."original_file_name") between 1 and 255)
);
--> statement-breakpoint
ALTER TABLE "document_blob" ADD CONSTRAINT "document_blob_version_id_document_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_file_location" ADD CONSTRAINT "document_file_location_version_id_document_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_document_id_managed_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."managed_document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_document" ADD CONSTRAINT "managed_document_owner_user_id_app_user_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_document" ADD CONSTRAINT "managed_document_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_blob_version" ON "document_blob" USING btree ("master_fn","company_fn","version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_file_location_version" ON "document_file_location" USING btree ("master_fn","company_fn","version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_version" ON "document_version" USING btree ("master_fn","company_fn","document_id","version_no");--> statement-breakpoint
CREATE INDEX "idx_document_version_hash" ON "document_version" USING btree ("master_fn","company_fn","sha256","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_managed_document_key" ON "managed_document" USING btree ("master_fn","company_fn","document_key");--> statement-breakpoint
CREATE INDEX "idx_managed_document_owner" ON "managed_document" USING btree ("master_fn","company_fn","owner_user_id","id");--> statement-breakpoint
CREATE INDEX "idx_managed_document_retention" ON "managed_document" USING btree ("master_fn","company_fn","legal_hold","retention_until","id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_managed_document_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'managed document identity is immutable';
  END IF;
  IF OLD.master_fn IS DISTINCT FROM NEW.master_fn
    OR OLD.company_fn IS DISTINCT FROM NEW.company_fn
    OR OLD.document_key IS DISTINCT FROM NEW.document_key
    OR OLD.purpose IS DISTINCT FROM NEW.purpose
    OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id
    OR OLD.original_file_name IS DISTINCT FROM NEW.original_file_name
    OR OLD.created_by_user_id IS DISTINCT FROM NEW.created_by_user_id
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'managed document identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS managed_document_identity_immutable ON "managed_document";
--> statement-breakpoint
CREATE TRIGGER managed_document_identity_immutable
BEFORE UPDATE OR DELETE ON "managed_document"
FOR EACH ROW
EXECUTE FUNCTION prevent_managed_document_identity_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_document_fact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'document version and storage facts are append-only';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS document_version_append_only ON "document_version";
--> statement-breakpoint
CREATE TRIGGER document_version_append_only
BEFORE UPDATE OR DELETE ON "document_version"
FOR EACH ROW
EXECUTE FUNCTION prevent_document_fact_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS document_blob_append_only ON "document_blob";
--> statement-breakpoint
CREATE TRIGGER document_blob_append_only
BEFORE UPDATE OR DELETE ON "document_blob"
FOR EACH ROW
EXECUTE FUNCTION prevent_document_fact_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS document_file_location_append_only ON "document_file_location";
--> statement-breakpoint
CREATE TRIGGER document_file_location_append_only
BEFORE UPDATE OR DELETE ON "document_file_location"
FOR EACH ROW
EXECUTE FUNCTION prevent_document_fact_mutation();
