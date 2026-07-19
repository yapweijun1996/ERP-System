CREATE TABLE "progress_claim" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "progress_claim_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"project_id" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"claim_date" date NOT NULL,
	"description" text NOT NULL,
	"net_amount" numeric(18, 2) NOT NULL,
	"tax_code" text NOT NULL,
	"tax_rate" numeric(6, 3) NOT NULL,
	"tax_amount" numeric(18, 2) NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_progress_claim_status" CHECK ("progress_claim"."status" in ('draft', 'posted')),
	CONSTRAINT "ck_progress_claim_amount" CHECK ("progress_claim"."net_amount" > 0 and "progress_claim"."tax_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "project_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"project_no" text NOT NULL,
	"name" text NOT NULL,
	"customer_id" bigint,
	"manager_name" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"start_date" date NOT NULL,
	"due_date" date,
	"contract_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"billed_to_date" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_project_status" CHECK ("project"."status" in ('open', 'on_hold', 'completed')),
	CONSTRAINT "ck_project_contract" CHECK ("project"."contract_value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "progress_claim" ADD CONSTRAINT "progress_claim_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_progress_claim_docno" ON "progress_claim" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_progress_claim_project" ON "progress_claim" USING btree ("master_fn","company_fn","project_id","id");--> statement-breakpoint
CREATE INDEX "idx_progress_claim_status" ON "progress_claim" USING btree ("master_fn","company_fn","status","claim_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_project_no" ON "project" USING btree ("master_fn","company_fn","project_no");--> statement-breakpoint
CREATE INDEX "idx_project_status" ON "project" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
CREATE INDEX "idx_project_customer" ON "project" USING btree ("master_fn","company_fn","customer_id");