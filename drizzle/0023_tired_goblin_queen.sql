CREATE TABLE "employee" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"employee_no" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"department" text NOT NULL,
	"job_title" text NOT NULL,
	"employment_type" text DEFAULT 'Full-time' NOT NULL,
	"manager_id" bigint,
	"start_date" date NOT NULL,
	"annual_leave_days" integer DEFAULT 14 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_employee_employment_type" CHECK ("employee"."employment_type" in ('Full-time', 'Part-time', 'Contract', 'Intern')),
	CONSTRAINT "ck_employee_leave_days" CHECK ("employee"."annual_leave_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "leave_request" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_request_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"employee_id" bigint NOT NULL,
	"leave_type" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" integer NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_leave_request_type" CHECK ("leave_request"."leave_type" in ('Annual', 'Medical', 'Unpaid')),
	CONSTRAINT "ck_leave_request_status" CHECK ("leave_request"."status" in ('pending', 'approved', 'rejected')),
	CONSTRAINT "ck_leave_request_days" CHECK ("leave_request"."days" > 0),
	CONSTRAINT "ck_leave_request_dates" CHECK ("leave_request"."end_date" >= "leave_request"."start_date")
);
--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_manager_id_employee_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_employee_no" ON "employee" USING btree ("master_fn","company_fn","employee_no");--> statement-breakpoint
CREATE INDEX "idx_employee_active" ON "employee" USING btree ("master_fn","company_fn","is_active","id");--> statement-breakpoint
CREATE INDEX "idx_leave_request_employee" ON "leave_request" USING btree ("master_fn","company_fn","employee_id","id");--> statement-breakpoint
CREATE INDEX "idx_leave_request_status" ON "leave_request" USING btree ("master_fn","company_fn","status","id");