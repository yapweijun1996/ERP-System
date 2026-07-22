CREATE TABLE "sales_order_approval" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_order_approval_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"order_id" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"reason" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" bigint,
	"decided_by_name" text,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_sales_order_approval_status" CHECK ("sales_order_approval"."status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "sales_order_approval" ADD CONSTRAINT "sales_order_approval_order_id_sales_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_approval" ADD CONSTRAINT "sales_order_approval_decided_by_user_id_app_user_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_order_approval_order" ON "sales_order_approval" USING btree ("master_fn","company_fn","order_id");--> statement-breakpoint
CREATE INDEX "idx_sales_order_approval_status" ON "sales_order_approval" USING btree ("master_fn","company_fn","status","submitted_at","id");--> statement-breakpoint
ALTER TABLE "sales_order" ADD CONSTRAINT "ck_sales_order_status" CHECK ("sales_order"."status" in ('pending_approval', 'draft', 'confirmed', 'rejected', 'cancelled'));