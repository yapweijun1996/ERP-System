CREATE TABLE "project_time_entry" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "project_time_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"actor_user_id" bigint NOT NULL,
	"project_id" bigint NOT NULL,
	"work_date" date NOT NULL,
	"task" text NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_project_time_entry_hours" CHECK ("project_time_entry"."hours" > 0 and "project_time_entry"."hours" <= 24),
	CONSTRAINT "ck_project_time_entry_status" CHECK ("project_time_entry"."status" in ('active', 'voided')),
	CONSTRAINT "ck_project_time_entry_void_state" CHECK (("project_time_entry"."status" = 'active' and "project_time_entry"."void_reason" is null and "project_time_entry"."voided_at" is null)
      or ("project_time_entry"."status" = 'voided' and "project_time_entry"."void_reason" is not null and "project_time_entry"."voided_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "project_time_entry" ADD CONSTRAINT "project_time_entry_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_time_entry" ADD CONSTRAINT "project_time_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_project_time_entry_user_date" ON "project_time_entry" USING btree ("master_fn","company_fn","actor_user_id","work_date","id");--> statement-breakpoint
CREATE INDEX "idx_project_time_entry_project_date" ON "project_time_entry" USING btree ("master_fn","company_fn","project_id","work_date","id");