CREATE TABLE "purchase_requisition" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_requisition_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"req_no" text NOT NULL,
	"requested_by_name" text NOT NULL,
	"department" text NOT NULL,
	"needed_by_date" date NOT NULL,
	"priority" text DEFAULT 'Stock' NOT NULL,
	"justification" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"rejection_reason" text,
	"decided_at" timestamp with time zone,
	"estimated_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_purchase_requisition_priority" CHECK ("purchase_requisition"."priority" in ('Urgent', 'Project', 'Stock')),
	CONSTRAINT "ck_purchase_requisition_status" CHECK ("purchase_requisition"."status" in ('submitted', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "purchase_requisition_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_requisition_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"requisition_id" bigint NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" bigint NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"estimated_unit_cost" numeric(18, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_order" ADD COLUMN "requisition_id" bigint;--> statement-breakpoint
ALTER TABLE "purchase_requisition_line" ADD CONSTRAINT "purchase_requisition_line_requisition_id_purchase_requisition_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."purchase_requisition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requisition_line" ADD CONSTRAINT "purchase_requisition_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_requisition_no" ON "purchase_requisition" USING btree ("master_fn","company_fn","req_no");--> statement-breakpoint
CREATE INDEX "idx_purchase_requisition_status" ON "purchase_requisition" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requisition_line_req" ON "purchase_requisition_line" USING btree ("master_fn","company_fn","requisition_id");--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_requisition_id_purchase_requisition_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."purchase_requisition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_po_requisition" ON "purchase_order" USING btree ("master_fn","company_fn","requisition_id");