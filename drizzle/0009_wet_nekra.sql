CREATE TABLE "bom_component" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bom_component_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"bom_version_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint NOT NULL,
	"qty_per" numeric(18, 4) NOT NULL,
	"scrap_pct" numeric(7, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_bom_component_qty" CHECK ("bom_component"."qty_per" > 0),
	CONSTRAINT "ck_bom_component_scrap" CHECK ("bom_component"."scrap_pct" >= 0 and "bom_component"."scrap_pct" <= 100)
);
--> statement-breakpoint
CREATE TABLE "bom_version" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bom_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"bom_id" bigint NOT NULL,
	"revision" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"effective_from" date NOT NULL,
	"output_qty" numeric(18, 4) DEFAULT '1' NOT NULL,
	"uom" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_bom_version_status" CHECK ("bom_version"."status" in ('draft', 'active', 'obsolete')),
	CONSTRAINT "ck_bom_version_output_qty" CHECK ("bom_version"."output_qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "manufacturing_bom" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "manufacturing_bom_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"product_id" bigint NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_manufacturing_bom_status" CHECK ("manufacturing_bom"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "manufacturing_routing" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "manufacturing_routing_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"product_id" bigint NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_manufacturing_routing_status" CHECK ("manufacturing_routing"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "routing_operation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "routing_operation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"routing_id" bigint NOT NULL,
	"sequence" integer NOT NULL,
	"work_center_id" bigint NOT NULL,
	"name" text NOT NULL,
	"setup_hours" numeric(10, 4) DEFAULT '0' NOT NULL,
	"run_hours_per_unit" numeric(10, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_routing_operation_hours" CHECK ("routing_operation"."setup_hours" >= 0 and "routing_operation"."run_hours_per_unit" >= 0)
);
--> statement-breakpoint
CREATE TABLE "work_center" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_center_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"capacity_hours_per_day" numeric(10, 2) DEFAULT '8' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_work_center_capacity" CHECK ("work_center"."capacity_hours_per_day" > 0)
);
--> statement-breakpoint
CREATE TABLE "work_order" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_order_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"doc_no" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"product_id" bigint NOT NULL,
	"bom_version_id" bigint NOT NULL,
	"routing_id" bigint NOT NULL,
	"warehouse_id" bigint NOT NULL,
	"planned_qty" numeric(18, 4) NOT NULL,
	"completed_qty" numeric(18, 4) DEFAULT '0' NOT NULL,
	"start_date" date NOT NULL,
	"due_date" date NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"demand_source" text,
	"released_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_work_order_status" CHECK ("work_order"."status" in ('planned', 'released', 'in_progress', 'on_hold', 'completed', 'closed', 'cancelled')),
	CONSTRAINT "ck_work_order_qty" CHECK ("work_order"."planned_qty" > 0 and "work_order"."completed_qty" >= 0 and "work_order"."completed_qty" <= "work_order"."planned_qty"),
	CONSTRAINT "ck_work_order_priority" CHECK ("work_order"."priority" in ('low', 'normal', 'high', 'urgent')),
	CONSTRAINT "ck_work_order_dates" CHECK ("work_order"."due_date" >= "work_order"."start_date")
);
--> statement-breakpoint
CREATE TABLE "work_order_material" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_order_material_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"work_order_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint NOT NULL,
	"required_qty" numeric(18, 4) NOT NULL,
	"issued_qty" numeric(18, 4) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(18, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_work_order_material_qty" CHECK ("work_order_material"."required_qty" > 0 and "work_order_material"."issued_qty" >= 0 and "work_order_material"."issued_qty" <= "work_order_material"."required_qty")
);
--> statement-breakpoint
CREATE TABLE "work_order_operation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_order_operation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"work_order_id" bigint NOT NULL,
	"sequence" integer NOT NULL,
	"work_center_id" bigint NOT NULL,
	"name" text NOT NULL,
	"planned_hours" numeric(12, 4) NOT NULL,
	"actual_hours" numeric(12, 4) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_work_order_operation_hours" CHECK ("work_order_operation"."planned_hours" >= 0 and "work_order_operation"."actual_hours" >= 0),
	CONSTRAINT "ck_work_order_operation_status" CHECK ("work_order_operation"."status" in ('pending', 'ready', 'in_progress', 'completed', 'blocked', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "bom_component" ADD CONSTRAINT "bom_component_bom_version_id_bom_version_id_fk" FOREIGN KEY ("bom_version_id") REFERENCES "public"."bom_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_component" ADD CONSTRAINT "bom_component_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_version" ADD CONSTRAINT "bom_version_bom_id_manufacturing_bom_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."manufacturing_bom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_bom" ADD CONSTRAINT "manufacturing_bom_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_routing" ADD CONSTRAINT "manufacturing_routing_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_operation" ADD CONSTRAINT "routing_operation_routing_id_manufacturing_routing_id_fk" FOREIGN KEY ("routing_id") REFERENCES "public"."manufacturing_routing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_operation" ADD CONSTRAINT "routing_operation_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_bom_version_id_bom_version_id_fk" FOREIGN KEY ("bom_version_id") REFERENCES "public"."bom_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_routing_id_manufacturing_routing_id_fk" FOREIGN KEY ("routing_id") REFERENCES "public"."manufacturing_routing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order" ADD CONSTRAINT "work_order_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_material" ADD CONSTRAINT "work_order_material_work_order_id_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_material" ADD CONSTRAINT "work_order_material_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_operation" ADD CONSTRAINT "work_order_operation_work_order_id_work_order_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_operation" ADD CONSTRAINT "work_order_operation_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bom_component_line" ON "bom_component" USING btree ("master_fn","company_fn","bom_version_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_bom_component_product" ON "bom_component" USING btree ("master_fn","company_fn","product_id","bom_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bom_version_revision" ON "bom_version" USING btree ("master_fn","company_fn","bom_id","revision");--> statement-breakpoint
CREATE INDEX "idx_bom_version_active" ON "bom_version" USING btree ("master_fn","company_fn","bom_id","status","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_manufacturing_bom_code" ON "manufacturing_bom" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE INDEX "idx_manufacturing_bom_product" ON "manufacturing_bom" USING btree ("master_fn","company_fn","product_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_manufacturing_routing_code" ON "manufacturing_routing" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE INDEX "idx_manufacturing_routing_product" ON "manufacturing_routing" USING btree ("master_fn","company_fn","product_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_routing_operation_sequence" ON "routing_operation" USING btree ("master_fn","company_fn","routing_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_routing_operation_work_center" ON "routing_operation" USING btree ("master_fn","company_fn","work_center_id","routing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_work_center_code" ON "work_center" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE INDEX "idx_work_center_active" ON "work_center" USING btree ("master_fn","company_fn","is_active","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_work_order_docno" ON "work_order" USING btree ("master_fn","company_fn","doc_no");--> statement-breakpoint
CREATE INDEX "idx_work_order_status" ON "work_order" USING btree ("master_fn","company_fn","status","due_date","id");--> statement-breakpoint
CREATE INDEX "idx_work_order_product" ON "work_order" USING btree ("master_fn","company_fn","product_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_work_order_material_line" ON "work_order_material" USING btree ("master_fn","company_fn","work_order_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_work_order_material_product" ON "work_order_material" USING btree ("master_fn","company_fn","product_id","work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_work_order_operation_sequence" ON "work_order_operation" USING btree ("master_fn","company_fn","work_order_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_work_order_operation_work_center" ON "work_order_operation" USING btree ("master_fn","company_fn","work_center_id","status");