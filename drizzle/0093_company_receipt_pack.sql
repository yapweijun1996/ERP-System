CREATE TABLE "company_receipt_pack" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "company_receipt_pack_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"pack_key" text NOT NULL,
	"visibility" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"filters" jsonb NOT NULL,
	"rows" jsonb NOT NULL,
	"totals" jsonb NOT NULL,
	"source_sha256" text NOT NULL,
	"row_count" integer NOT NULL,
	"document_count" integer NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_company_receipt_pack_key" CHECK ("company_receipt_pack"."pack_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
	CONSTRAINT "ck_company_receipt_pack_visibility" CHECK ("company_receipt_pack"."visibility" in ('own','company')),
	CONSTRAINT "ck_company_receipt_pack_locale" CHECK ("company_receipt_pack"."locale" in ('en','ms','zh','ja','vi')),
	CONSTRAINT "ck_company_receipt_pack_json" CHECK (jsonb_typeof("company_receipt_pack"."filters") = 'object'
      and jsonb_typeof("company_receipt_pack"."rows") = 'array'
      and jsonb_typeof("company_receipt_pack"."totals") = 'array'),
	CONSTRAINT "ck_company_receipt_pack_hash" CHECK (char_length("company_receipt_pack"."source_sha256") = 64 and "company_receipt_pack"."source_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_company_receipt_pack_counts" CHECK ("company_receipt_pack"."row_count" between 1 and 5000
      and "company_receipt_pack"."document_count" between 1 and "company_receipt_pack"."row_count")
);
--> statement-breakpoint
ALTER TABLE "company_receipt_pack" ADD CONSTRAINT "company_receipt_pack_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_receipt_pack_key" ON "company_receipt_pack" USING btree ("master_fn","company_fn","pack_key");
--> statement-breakpoint
CREATE INDEX "idx_company_receipt_pack_actor" ON "company_receipt_pack" USING btree ("master_fn","company_fn","created_by_user_id","created_at","id");
