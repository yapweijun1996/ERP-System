CREATE TABLE "mrp_run" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mrp_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"planning_date" date NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_mrp_run_status" CHECK ("mrp_run"."status" in ('running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "mrp_suggestion" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mrp_suggestion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"mrp_run_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"gross_requirement" numeric(18, 4) NOT NULL,
	"on_hand" numeric(18, 4) NOT NULL,
	"on_order" numeric(18, 4) DEFAULT '0' NOT NULL,
	"net_requirement" numeric(18, 4) NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_mrp_suggestion_qty" CHECK ("mrp_suggestion"."gross_requirement" >= 0 and "mrp_suggestion"."on_hand" >= 0 and "mrp_suggestion"."on_order" >= 0),
	CONSTRAINT "ck_mrp_suggestion_action" CHECK ("mrp_suggestion"."action" in ('purchase', 'sufficient')),
	CONSTRAINT "ck_mrp_suggestion_status" CHECK ("mrp_suggestion"."status" in ('open', 'accepted', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "mrp_suggestion" ADD CONSTRAINT "mrp_suggestion_mrp_run_id_mrp_run_id_fk" FOREIGN KEY ("mrp_run_id") REFERENCES "public"."mrp_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrp_suggestion" ADD CONSTRAINT "mrp_suggestion_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mrp_run_docno" ON "mrp_run" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_mrp_run_date" ON "mrp_run" USING btree ("master_fn","company_fn","planning_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mrp_suggestion_product" ON "mrp_suggestion" USING btree ("master_fn","company_fn","mrp_run_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_mrp_suggestion_action" ON "mrp_suggestion" USING btree ("master_fn","company_fn","action","status","id");