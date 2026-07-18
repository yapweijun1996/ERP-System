CREATE TABLE "quality_corrective_action" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quality_corrective_action_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"ncr_id" bigint NOT NULL,
	"sequence" integer NOT NULL,
	"action" text NOT NULL,
	"owner_name" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_quality_corrective_action_status" CHECK ("quality_corrective_action"."status" in ('open', 'in_progress', 'completed')),
	CONSTRAINT "ck_quality_corrective_action_sequence" CHECK ("quality_corrective_action"."sequence" > 0)
);
--> statement-breakpoint
CREATE TABLE "quality_inspection" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quality_inspection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"inspection_type" text NOT NULL,
	"plan_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"lot_id" bigint,
	"source_type" text NOT NULL,
	"source_id" bigint,
	"source_ref" text,
	"lot_qty" numeric(18, 4) NOT NULL,
	"sample_qty" numeric(18, 4) NOT NULL,
	"inspector_name" text NOT NULL,
	"inspection_date" date NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_quality_inspection_status" CHECK ("quality_inspection"."status" in ('scheduled', 'in_inspection', 'passed', 'failed', 'closed')),
	CONSTRAINT "ck_quality_inspection_type" CHECK ("quality_inspection"."inspection_type" in ('incoming', 'in_process', 'final')),
	CONSTRAINT "ck_quality_inspection_source" CHECK ("quality_inspection"."source_type" in ('goods_receipt', 'work_order', 'manual')),
	CONSTRAINT "ck_quality_inspection_qty" CHECK ("quality_inspection"."lot_qty" > 0 and "quality_inspection"."sample_qty" > 0 and "quality_inspection"."sample_qty" <= "quality_inspection"."lot_qty")
);
--> statement-breakpoint
CREATE TABLE "quality_inspection_plan" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quality_inspection_plan_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"inspection_type" text NOT NULL,
	"product_id" bigint,
	"sample_size" numeric(18, 4) DEFAULT '1' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_quality_inspection_plan_type" CHECK ("quality_inspection_plan"."inspection_type" in ('incoming', 'in_process', 'final')),
	CONSTRAINT "ck_quality_inspection_plan_sample" CHECK ("quality_inspection_plan"."sample_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "quality_inspection_plan_item" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quality_inspection_plan_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"plan_id" bigint NOT NULL,
	"sequence" integer NOT NULL,
	"characteristic" text NOT NULL,
	"specification" text NOT NULL,
	"method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_quality_inspection_plan_item_sequence" CHECK ("quality_inspection_plan_item"."sequence" > 0)
);
--> statement-breakpoint
CREATE TABLE "quality_inspection_result" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quality_inspection_result_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"inspection_id" bigint NOT NULL,
	"plan_item_id" bigint,
	"sequence" integer NOT NULL,
	"characteristic" text NOT NULL,
	"specification" text NOT NULL,
	"method" text NOT NULL,
	"measured_value" text,
	"result" text DEFAULT 'pending' NOT NULL,
	"defect_class" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_quality_inspection_result_status" CHECK ("quality_inspection_result"."result" in ('pending', 'pass', 'fail')),
	CONSTRAINT "ck_quality_inspection_result_defect" CHECK ("quality_inspection_result"."defect_class" is null or "quality_inspection_result"."defect_class" in ('critical', 'major', 'minor'))
);
--> statement-breakpoint
CREATE TABLE "quality_ncr" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quality_ncr_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"inspection_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"lot_id" bigint,
	"severity" text NOT NULL,
	"affected_qty" numeric(18, 4) NOT NULL,
	"defect_description" text NOT NULL,
	"disposition" text DEFAULT 'quarantine' NOT NULL,
	"root_cause" text,
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_quality_ncr_status" CHECK ("quality_ncr"."status" in ('open', 'in_progress', 'closed')),
	CONSTRAINT "ck_quality_ncr_severity" CHECK ("quality_ncr"."severity" in ('critical', 'major', 'minor')),
	CONSTRAINT "ck_quality_ncr_disposition" CHECK ("quality_ncr"."disposition" in ('quarantine', 'release', 'rework', 'return', 'scrap')),
	CONSTRAINT "ck_quality_ncr_qty" CHECK ("quality_ncr"."affected_qty" > 0)
);
--> statement-breakpoint
ALTER TABLE "quality_corrective_action" ADD CONSTRAINT "quality_corrective_action_ncr_id_quality_ncr_id_fk" FOREIGN KEY ("ncr_id") REFERENCES "public"."quality_ncr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_plan_id_quality_inspection_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."quality_inspection_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_lot_id_inventory_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspection_plan" ADD CONSTRAINT "quality_inspection_plan_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspection_plan_item" ADD CONSTRAINT "quality_inspection_plan_item_plan_id_quality_inspection_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."quality_inspection_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspection_result" ADD CONSTRAINT "quality_inspection_result_inspection_id_quality_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."quality_inspection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspection_result" ADD CONSTRAINT "quality_inspection_result_plan_item_id_quality_inspection_plan_item_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."quality_inspection_plan_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_ncr" ADD CONSTRAINT "quality_ncr_inspection_id_quality_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."quality_inspection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_ncr" ADD CONSTRAINT "quality_ncr_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_ncr" ADD CONSTRAINT "quality_ncr_lot_id_inventory_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quality_corrective_action_sequence" ON "quality_corrective_action" USING btree ("master_fn","company_fn","ncr_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_quality_corrective_action_status" ON "quality_corrective_action" USING btree ("master_fn","company_fn","status","due_date","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quality_inspection_docno" ON "quality_inspection" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_quality_inspection_status" ON "quality_inspection" USING btree ("master_fn","company_fn","status","inspection_date","id");--> statement-breakpoint
CREATE INDEX "idx_quality_inspection_lot" ON "quality_inspection" USING btree ("master_fn","company_fn","lot_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quality_inspection_plan_code" ON "quality_inspection_plan" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE INDEX "idx_quality_inspection_plan_active" ON "quality_inspection_plan" USING btree ("master_fn","company_fn","inspection_type","is_active","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quality_inspection_plan_item_sequence" ON "quality_inspection_plan_item" USING btree ("master_fn","company_fn","plan_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_quality_inspection_plan_item" ON "quality_inspection_plan_item" USING btree ("master_fn","company_fn","plan_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quality_inspection_result_sequence" ON "quality_inspection_result" USING btree ("master_fn","company_fn","inspection_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_quality_inspection_result" ON "quality_inspection_result" USING btree ("master_fn","company_fn","inspection_id","result","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quality_ncr_docno" ON "quality_ncr" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quality_ncr_inspection" ON "quality_ncr" USING btree ("master_fn","company_fn","inspection_id");--> statement-breakpoint
CREATE INDEX "idx_quality_ncr_status" ON "quality_ncr" USING btree ("master_fn","company_fn","status","raised_at","id");--> statement-breakpoint
CREATE INDEX "idx_quality_ncr_lot" ON "quality_ncr" USING btree ("master_fn","company_fn","lot_id","id");