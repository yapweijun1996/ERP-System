-- Append-only user-facing document access proof; survives governed content purge.
CREATE TABLE "document_access_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_access_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"document_id" bigint NOT NULL,
	"version_id" bigint NOT NULL,
	"version_no" integer NOT NULL,
	"version_sha256" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"access_action" text NOT NULL,
	"access_purpose" text NOT NULL,
	"access_key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_document_access_event_version" CHECK ("document_access_event"."version_no" > 0),
	CONSTRAINT "ck_document_access_event_hash" CHECK (char_length("document_access_event"."version_sha256") = 64
      and "document_access_event"."version_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_document_access_event_action" CHECK ("document_access_event"."access_action" in ('view','download','print','export')),
	CONSTRAINT "ck_document_access_event_purpose" CHECK (char_length("document_access_event"."access_purpose") between 3 and 500),
	CONSTRAINT "ck_document_access_event_key" CHECK (char_length("document_access_event"."access_key") between 8 and 128
      and "document_access_event"."access_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$')
);
--> statement-breakpoint
ALTER TABLE "document_access_event" ADD CONSTRAINT "document_access_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_access_event_key" ON "document_access_event" USING btree ("master_fn","company_fn","actor_user_id","access_key");--> statement-breakpoint
CREATE INDEX "idx_document_access_event_document" ON "document_access_event" USING btree ("master_fn","company_fn","document_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "idx_document_access_event_actor" ON "document_access_event" USING btree ("master_fn","company_fn","actor_user_id","occurred_at","id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_document_access_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'document_access_event is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS document_access_event_append_only ON document_access_event;
--> statement-breakpoint
CREATE TRIGGER document_access_event_append_only
BEFORE UPDATE OR DELETE ON document_access_event
FOR EACH ROW EXECUTE FUNCTION prevent_document_access_event_mutation();
