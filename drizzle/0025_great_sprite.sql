CREATE TABLE "service_contract" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "service_contract_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"contract_no" text NOT NULL,
	"customer_id" bigint NOT NULL,
	"plan" text NOT NULL,
	"sla_response_hours" integer,
	"assets_covered" integer DEFAULT 0 NOT NULL,
	"start_date" date NOT NULL,
	"expiry_date" date NOT NULL,
	"annual_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_service_contract_plan" CHECK ("service_contract"."plan" in ('Gold', 'Silver', 'Bronze')),
	CONSTRAINT "ck_service_contract_sla" CHECK ("service_contract"."sla_response_hours" is null or "service_contract"."sla_response_hours" > 0),
	CONSTRAINT "ck_service_contract_assets" CHECK ("service_contract"."assets_covered" >= 0)
);
--> statement-breakpoint
CREATE TABLE "service_ticket" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "service_ticket_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"ticket_no" text NOT NULL,
	"customer_id" bigint NOT NULL,
	"contract_id" bigint,
	"asset_description" text NOT NULL,
	"serial_no" text,
	"issue" text NOT NULL,
	"diagnosis" text,
	"priority" text DEFAULT 'Medium' NOT NULL,
	"coverage" text DEFAULT 'out_of_warranty' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"technician_name" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_service_ticket_priority" CHECK ("service_ticket"."priority" in ('Critical', 'High', 'Medium', 'Low')),
	CONSTRAINT "ck_service_ticket_coverage" CHECK ("service_ticket"."coverage" in ('in_warranty', 'contract', 'out_of_warranty')),
	CONSTRAINT "ck_service_ticket_status" CHECK ("service_ticket"."status" in ('open', 'in_progress', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "service_contract" ADD CONSTRAINT "service_contract_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_ticket" ADD CONSTRAINT "service_ticket_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_ticket" ADD CONSTRAINT "service_ticket_contract_id_service_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."service_contract"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_service_contract_no" ON "service_contract" USING btree ("master_fn","company_fn","contract_no");--> statement-breakpoint
CREATE INDEX "idx_service_contract_customer" ON "service_contract" USING btree ("master_fn","company_fn","customer_id");--> statement-breakpoint
CREATE INDEX "idx_service_contract_expiry" ON "service_contract" USING btree ("master_fn","company_fn","expiry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_service_ticket_no" ON "service_ticket" USING btree ("master_fn","company_fn","ticket_no");--> statement-breakpoint
CREATE INDEX "idx_service_ticket_customer" ON "service_ticket" USING btree ("master_fn","company_fn","customer_id");--> statement-breakpoint
CREATE INDEX "idx_service_ticket_status" ON "service_ticket" USING btree ("master_fn","company_fn","status","id");