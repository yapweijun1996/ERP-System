CREATE TABLE "approval_capacity_snapshot" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "approval_capacity_snapshot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"instance_id" bigint NOT NULL,
	"rule_id" bigint,
	"evaluation_stage" text NOT NULL,
	"action" text NOT NULL,
	"minimum_staff" integer NOT NULL,
	"active_staff" integer NOT NULL,
	"unavailable_staff" integer NOT NULL,
	"remaining_staff" integer NOT NULL,
	"breached" boolean NOT NULL,
	"event_key" text NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_approval_capacity_snapshot_stage" CHECK ("approval_capacity_snapshot"."evaluation_stage" in ('submission', 'final_approval')),
	CONSTRAINT "ck_approval_capacity_snapshot_action" CHECK ("approval_capacity_snapshot"."action" in ('none', 'warn', 'extra_approval', 'block')),
	CONSTRAINT "ck_approval_capacity_snapshot_counts" CHECK ("approval_capacity_snapshot"."minimum_staff" >= 0 and "approval_capacity_snapshot"."active_staff" >= 0
      and "approval_capacity_snapshot"."unavailable_staff" >= 0)
);
--> statement-breakpoint
CREATE TABLE "approval_decision" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "approval_decision_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"instance_id" bigint NOT NULL,
	"step_id" bigint NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"actor_user_id" bigint NOT NULL,
	"actor_employee_id" bigint,
	"authority_source" text NOT NULL,
	"original_authority_type" text NOT NULL,
	"original_authority_employee_id" bigint,
	"original_authority_user_id" bigint,
	"original_authority_permission_key" text,
	"delegation_id" bigint,
	"event_key" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_approval_decision_value" CHECK ("approval_decision"."decision" in ('approved', 'rejected')),
	CONSTRAINT "ck_approval_decision_authority_source" CHECK ("approval_decision"."authority_source" in ('direct', 'delegated', 'permission', 'escalated'))
);
--> statement-breakpoint
CREATE TABLE "approval_delegation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "approval_delegation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"domain" text,
	"authority_employee_id" bigint NOT NULL,
	"delegate_employee_id" bigint NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_approval_delegation_distinct" CHECK ("approval_delegation"."authority_employee_id" <> "approval_delegation"."delegate_employee_id"),
	CONSTRAINT "ck_approval_delegation_dates" CHECK ("approval_delegation"."valid_to" > "approval_delegation"."valid_from"),
	CONSTRAINT "ck_approval_delegation_reason" CHECK (char_length(trim("approval_delegation"."reason")) between 3 and 500),
	CONSTRAINT "ck_approval_delegation_revocation" CHECK (("approval_delegation"."revoked_at" is null and "approval_delegation"."revoked_by_user_id" is null)
      or ("approval_delegation"."revoked_at" is not null and "approval_delegation"."revoked_by_user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "approval_instance" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "approval_instance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"domain" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" bigint NOT NULL,
	"entity_version" integer NOT NULL,
	"policy_version_id" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_step_no" integer DEFAULT 1 NOT NULL,
	"subject_employee_id" bigint,
	"submitted_by_user_id" bigint NOT NULL,
	"department" text,
	"type_ref" text,
	"days" numeric(10, 2),
	"amount" numeric(18, 2),
	"currency" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_approval_instance_entity_version" CHECK ("approval_instance"."entity_id" > 0 and "approval_instance"."entity_version" > 0),
	CONSTRAINT "ck_approval_instance_status" CHECK ("approval_instance"."status" in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "ck_approval_instance_current_step" CHECK ("approval_instance"."current_step_no" > 0)
);
--> statement-breakpoint
CREATE TABLE "approval_instance_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "approval_instance_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"instance_id" bigint NOT NULL,
	"step_id" bigint,
	"event_type" text NOT NULL,
	"actor_user_id" bigint,
	"detail" text,
	"event_key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_approval_instance_event_type" CHECK ("approval_instance_event"."event_type" in (
      'created', 'step_activated', 'reminder_sent', 'escalated',
      'step_approved', 'approved', 'rejected', 'cancelled', 'capacity_evaluated'
    ))
);
--> statement-breakpoint
CREATE TABLE "approval_instance_step" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "approval_instance_step_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"instance_id" bigint NOT NULL,
	"policy_step_id" bigint,
	"step_no" integer NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"original_authority_type" text NOT NULL,
	"original_authority_employee_id" bigint,
	"original_authority_user_id" bigint,
	"original_authority_permission_key" text,
	"current_authority_type" text NOT NULL,
	"current_authority_employee_id" bigint,
	"current_authority_user_id" bigint,
	"current_authority_permission_key" text,
	"escalation_authority_type" text,
	"escalation_authority_employee_id" bigint,
	"escalation_authority_user_id" bigint,
	"escalation_authority_permission_key" text,
	"activated_at" timestamp with time zone,
	"reminder_due_at" timestamp with time zone,
	"escalation_due_at" timestamp with time zone,
	"reminded_at" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_approval_instance_step_no" CHECK ("approval_instance_step"."step_no" > 0),
	CONSTRAINT "ck_approval_instance_step_status" CHECK ("approval_instance_step"."status" in ('waiting', 'pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "ck_approval_instance_step_authority_type" CHECK ("approval_instance_step"."original_authority_type" in ('employee', 'permission')
      and "approval_instance_step"."current_authority_type" in ('employee', 'permission')
      and ("approval_instance_step"."escalation_authority_type" is null
        or "approval_instance_step"."escalation_authority_type" in ('employee', 'permission')))
);
--> statement-breakpoint
CREATE TABLE "approval_policy" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "approval_policy_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_approval_policy_domain" CHECK ("approval_policy"."domain" ~ '^[a-z][a-z0-9_]{0,47}$')
);
--> statement-breakpoint
CREATE TABLE "approval_policy_step" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "approval_policy_step_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"policy_version_id" bigint NOT NULL,
	"step_no" integer NOT NULL,
	"label" text NOT NULL,
	"authority_type" text NOT NULL,
	"authority_employee_id" bigint,
	"authority_permission_key" text,
	"manager_level" integer DEFAULT 1 NOT NULL,
	"fallback_permission_key" text,
	"reminder_after_hours" integer,
	"escalate_after_hours" integer,
	"escalation_authority_type" text,
	"escalation_employee_id" bigint,
	"escalation_permission_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_approval_policy_step_no" CHECK ("approval_policy_step"."step_no" > 0),
	CONSTRAINT "ck_approval_policy_step_authority_type" CHECK ("approval_policy_step"."authority_type" in ('direct_manager', 'permission', 'named_employee')),
	CONSTRAINT "ck_approval_policy_step_authority_shape" CHECK (("approval_policy_step"."authority_type" = 'direct_manager'
        and "approval_policy_step"."authority_employee_id" is null
        and "approval_policy_step"."authority_permission_key" is null
        and "approval_policy_step"."manager_level" > 0)
      or ("approval_policy_step"."authority_type" = 'permission'
        and "approval_policy_step"."authority_employee_id" is null
        and "approval_policy_step"."authority_permission_key" is not null)
      or ("approval_policy_step"."authority_type" = 'named_employee'
        and "approval_policy_step"."authority_employee_id" is not null
        and "approval_policy_step"."authority_permission_key" is null)),
	CONSTRAINT "ck_approval_policy_step_timers" CHECK (("approval_policy_step"."reminder_after_hours" is null or "approval_policy_step"."reminder_after_hours" > 0)
      and ("approval_policy_step"."escalate_after_hours" is null or "approval_policy_step"."escalate_after_hours" > 0)
      and ("approval_policy_step"."reminder_after_hours" is null or "approval_policy_step"."escalate_after_hours" is null
        or "approval_policy_step"."escalate_after_hours" >= "approval_policy_step"."reminder_after_hours")),
	CONSTRAINT "ck_approval_policy_step_escalation_type" CHECK ("approval_policy_step"."escalation_authority_type" is null
      or "approval_policy_step"."escalation_authority_type" in ('permission', 'named_employee'))
);
--> statement-breakpoint
CREATE TABLE "approval_policy_version" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "approval_policy_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"policy_id" bigint NOT NULL,
	"version_no" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"employee_id" bigint,
	"department" text,
	"type_ref" text,
	"minimum_days" numeric(10, 2),
	"maximum_days" numeric(10, 2),
	"minimum_amount" numeric(18, 2),
	"maximum_amount" numeric(18, 2),
	"currency" text,
	"confirmed_by_user_id" bigint,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_approval_policy_version_no" CHECK ("approval_policy_version"."version_no" > 0),
	CONSTRAINT "ck_approval_policy_version_status" CHECK ("approval_policy_version"."status" in ('draft', 'confirmed', 'retired')),
	CONSTRAINT "ck_approval_policy_version_dates" CHECK ("approval_policy_version"."effective_to" is null or "approval_policy_version"."effective_to" >= "approval_policy_version"."effective_from"),
	CONSTRAINT "ck_approval_policy_version_days" CHECK (("approval_policy_version"."minimum_days" is null or "approval_policy_version"."minimum_days" >= 0)
      and ("approval_policy_version"."maximum_days" is null or "approval_policy_version"."maximum_days" >= 0)
      and ("approval_policy_version"."minimum_days" is null or "approval_policy_version"."maximum_days" is null or "approval_policy_version"."maximum_days" >= "approval_policy_version"."minimum_days")),
	CONSTRAINT "ck_approval_policy_version_amounts" CHECK (("approval_policy_version"."minimum_amount" is null or "approval_policy_version"."minimum_amount" >= 0)
      and ("approval_policy_version"."maximum_amount" is null or "approval_policy_version"."maximum_amount" >= 0)
      and ("approval_policy_version"."minimum_amount" is null or "approval_policy_version"."maximum_amount" is null or "approval_policy_version"."maximum_amount" >= "approval_policy_version"."minimum_amount")),
	CONSTRAINT "ck_approval_policy_version_currency" CHECK ("approval_policy_version"."currency" is null or "approval_policy_version"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_approval_policy_version_confirmation" CHECK (("approval_policy_version"."status" = 'confirmed' and "approval_policy_version"."confirmed_at" is not null and "approval_policy_version"."confirmed_by_user_id" is not null)
      or ("approval_policy_version"."status" <> 'confirmed'))
);
--> statement-breakpoint
CREATE TABLE "leave_capacity_rule" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_capacity_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"department" text,
	"type_ref" text,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"minimum_staff" integer NOT NULL,
	"action" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"extra_approval_permission_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_leave_capacity_rule_dates" CHECK ("leave_capacity_rule"."effective_to" is null or "leave_capacity_rule"."effective_to" >= "leave_capacity_rule"."effective_from"),
	CONSTRAINT "ck_leave_capacity_rule_staff" CHECK ("leave_capacity_rule"."minimum_staff" >= 0),
	CONSTRAINT "ck_leave_capacity_rule_action" CHECK ("leave_capacity_rule"."action" in ('warn', 'extra_approval', 'block')),
	CONSTRAINT "ck_leave_capacity_rule_extra" CHECK ("leave_capacity_rule"."action" <> 'extra_approval' or "leave_capacity_rule"."extra_approval_permission_key" is not null)
);
--> statement-breakpoint
ALTER TABLE "approval_capacity_snapshot" ADD CONSTRAINT "approval_capacity_snapshot_instance_id_approval_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."approval_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_capacity_snapshot" ADD CONSTRAINT "approval_capacity_snapshot_rule_id_leave_capacity_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."leave_capacity_rule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_instance_id_approval_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."approval_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_step_id_approval_instance_step_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."approval_instance_step"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_actor_employee_id_employee_id_fk" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_original_authority_employee_id_employee_id_fk" FOREIGN KEY ("original_authority_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_original_authority_user_id_app_user_user_id_fk" FOREIGN KEY ("original_authority_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_delegation_id_approval_delegation_id_fk" FOREIGN KEY ("delegation_id") REFERENCES "public"."approval_delegation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_delegation" ADD CONSTRAINT "approval_delegation_authority_employee_id_employee_id_fk" FOREIGN KEY ("authority_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_delegation" ADD CONSTRAINT "approval_delegation_delegate_employee_id_employee_id_fk" FOREIGN KEY ("delegate_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_delegation" ADD CONSTRAINT "approval_delegation_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_delegation" ADD CONSTRAINT "approval_delegation_revoked_by_user_id_app_user_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance" ADD CONSTRAINT "approval_instance_policy_version_id_approval_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."approval_policy_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance" ADD CONSTRAINT "approval_instance_subject_employee_id_employee_id_fk" FOREIGN KEY ("subject_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance" ADD CONSTRAINT "approval_instance_submitted_by_user_id_app_user_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance_event" ADD CONSTRAINT "approval_instance_event_instance_id_approval_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."approval_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance_event" ADD CONSTRAINT "approval_instance_event_step_id_approval_instance_step_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."approval_instance_step"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance_event" ADD CONSTRAINT "approval_instance_event_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance_step" ADD CONSTRAINT "approval_instance_step_instance_id_approval_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."approval_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance_step" ADD CONSTRAINT "approval_instance_step_policy_step_id_approval_policy_step_id_fk" FOREIGN KEY ("policy_step_id") REFERENCES "public"."approval_policy_step"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance_step" ADD CONSTRAINT "approval_instance_step_original_authority_employee_id_employee_id_fk" FOREIGN KEY ("original_authority_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance_step" ADD CONSTRAINT "approval_instance_step_original_authority_user_id_app_user_user_id_fk" FOREIGN KEY ("original_authority_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance_step" ADD CONSTRAINT "approval_instance_step_current_authority_employee_id_employee_id_fk" FOREIGN KEY ("current_authority_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance_step" ADD CONSTRAINT "approval_instance_step_current_authority_user_id_app_user_user_id_fk" FOREIGN KEY ("current_authority_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance_step" ADD CONSTRAINT "approval_instance_step_escalation_authority_employee_id_employee_id_fk" FOREIGN KEY ("escalation_authority_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instance_step" ADD CONSTRAINT "approval_instance_step_escalation_authority_user_id_app_user_user_id_fk" FOREIGN KEY ("escalation_authority_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_policy_step" ADD CONSTRAINT "approval_policy_step_policy_version_id_approval_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."approval_policy_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_policy_step" ADD CONSTRAINT "approval_policy_step_authority_employee_id_employee_id_fk" FOREIGN KEY ("authority_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_policy_step" ADD CONSTRAINT "approval_policy_step_escalation_employee_id_employee_id_fk" FOREIGN KEY ("escalation_employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_policy_version" ADD CONSTRAINT "approval_policy_version_policy_id_approval_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."approval_policy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_policy_version" ADD CONSTRAINT "approval_policy_version_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_policy_version" ADD CONSTRAINT "approval_policy_version_confirmed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_capacity_snapshot_key" ON "approval_capacity_snapshot" USING btree ("master_fn","company_fn","event_key");--> statement-breakpoint
CREATE INDEX "idx_approval_capacity_snapshot_history" ON "approval_capacity_snapshot" USING btree ("master_fn","company_fn","instance_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_decision_step" ON "approval_decision" USING btree ("master_fn","company_fn","step_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_decision_event_key" ON "approval_decision" USING btree ("master_fn","company_fn","event_key");--> statement-breakpoint
CREATE INDEX "idx_approval_decision_history" ON "approval_decision" USING btree ("master_fn","company_fn","instance_id","id");--> statement-breakpoint
CREATE INDEX "idx_approval_delegation_authority" ON "approval_delegation" USING btree ("master_fn","company_fn","authority_employee_id","valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "idx_approval_delegation_delegate" ON "approval_delegation" USING btree ("master_fn","company_fn","delegate_employee_id","valid_from","valid_to");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_instance_entity_version" ON "approval_instance" USING btree ("master_fn","company_fn","domain","entity_type","entity_id","entity_version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_instance_scope_id" ON "approval_instance" USING btree ("id","master_fn","company_fn");--> statement-breakpoint
CREATE INDEX "idx_approval_instance_status" ON "approval_instance" USING btree ("master_fn","company_fn","domain","status","current_step_no","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_instance_event_key" ON "approval_instance_event" USING btree ("master_fn","company_fn","event_key");--> statement-breakpoint
CREATE INDEX "idx_approval_instance_event_history" ON "approval_instance_event" USING btree ("master_fn","company_fn","instance_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_instance_step" ON "approval_instance_step" USING btree ("master_fn","company_fn","instance_id","step_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_instance_step_scope_id" ON "approval_instance_step" USING btree ("id","master_fn","company_fn");--> statement-breakpoint
CREATE INDEX "idx_approval_instance_step_queue" ON "approval_instance_step" USING btree ("master_fn","company_fn","status","current_authority_user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_policy_code" ON "approval_policy" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_policy_scope_id" ON "approval_policy" USING btree ("id","master_fn","company_fn");--> statement-breakpoint
CREATE INDEX "idx_approval_policy_domain" ON "approval_policy" USING btree ("master_fn","company_fn","domain","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_policy_step" ON "approval_policy_step" USING btree ("master_fn","company_fn","policy_version_id","step_no");--> statement-breakpoint
CREATE INDEX "idx_approval_policy_step_order" ON "approval_policy_step" USING btree ("master_fn","company_fn","policy_version_id","step_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_policy_version" ON "approval_policy_version" USING btree ("master_fn","company_fn","policy_id","version_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_policy_version_scope_id" ON "approval_policy_version" USING btree ("id","master_fn","company_fn");--> statement-breakpoint
CREATE INDEX "idx_approval_policy_version_resolution" ON "approval_policy_version" USING btree ("master_fn","company_fn","status","effective_from","effective_to","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leave_capacity_rule_code" ON "leave_capacity_rule" USING btree ("master_fn","company_fn","code");--> statement-breakpoint
CREATE INDEX "idx_leave_capacity_rule_resolution" ON "leave_capacity_rule" USING btree ("master_fn","company_fn","is_active","effective_from","effective_to","priority");
