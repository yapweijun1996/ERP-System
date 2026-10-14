CREATE TABLE "company_profile" (
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"registration_no" text DEFAULT '' NOT NULL,
	"tax_no" text DEFAULT '' NOT NULL,
	"address_line_1" text DEFAULT '' NOT NULL,
	"address_line_2" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"postal_code" text DEFAULT '' NOT NULL,
	"logo_data_url" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_profile_master_fn_company_fn_pk" PRIMARY KEY("master_fn","company_fn"),
	CONSTRAINT "ck_company_profile_version" CHECK ("company_profile"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "company_profile" ADD CONSTRAINT "fk_company_profile_company" FOREIGN KEY ("master_fn","company_fn") REFERENCES "public"."company"("master_fn","company_fn") ON DELETE no action ON UPDATE no action;