CREATE TABLE "sales_credit_profile" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_credit_profile_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"customer_id" bigint NOT NULL,
	"currency" text NOT NULL,
	"credit_limit" numeric(18, 2) NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"hold_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_credit_profile_status" CHECK ("sales_credit_profile"."status" in ('open', 'held')),
	CONSTRAINT "ck_sales_credit_profile_limit" CHECK ("sales_credit_profile"."credit_limit" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sales_credit_profile" ADD CONSTRAINT "sales_credit_profile_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_credit_profile_customer" ON "sales_credit_profile" USING btree ("master_fn","company_fn","customer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_credit_profile_status" ON "sales_credit_profile" USING btree ("master_fn","company_fn","status","customer_id");