-- TASK-125: line-level expense approval, duplicate-risk evidence, and budget controls.
CREATE TABLE "expense_control_policy_version" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_control_policy_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"policy_key" text NOT NULL,
	"version_no" integer NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"duplicate_high_risk_score" integer DEFAULT 70 NOT NULL,
	"budget_action" text DEFAULT 'warn' NOT NULL,
	"budget_tolerance_pct" numeric(7, 4) DEFAULT '0' NOT NULL,
	"budget_extra_approval_permission_key" text,
	"confirmed_by_user_id" bigint NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_control_policy_key" CHECK ("expense_control_policy_version"."policy_key" ~ '^[a-z][a-z0-9._-]{2,63}$'),
	CONSTRAINT "ck_expense_control_policy_version_no" CHECK ("expense_control_policy_version"."version_no" > 0),
	CONSTRAINT "ck_expense_control_policy_dates" CHECK ("expense_control_policy_version"."valid_to" is null or "expense_control_policy_version"."valid_to" >= "expense_control_policy_version"."valid_from"),
	CONSTRAINT "ck_expense_control_policy_status" CHECK ("expense_control_policy_version"."status" = 'confirmed'),
	CONSTRAINT "ck_expense_control_policy_duplicate_score" CHECK ("expense_control_policy_version"."duplicate_high_risk_score" between 1 and 100),
	CONSTRAINT "ck_expense_control_policy_budget_action" CHECK ("expense_control_policy_version"."budget_action" in ('warn','extra_approval','block')),
	CONSTRAINT "ck_expense_control_policy_budget_tolerance" CHECK ("expense_control_policy_version"."budget_tolerance_pct" between 0.0000 and 100.0000),
	CONSTRAINT "ck_expense_control_policy_budget_extra" CHECK ("expense_control_policy_version"."budget_action" <> 'extra_approval'
      or char_length("expense_control_policy_version"."budget_extra_approval_permission_key") between 3 and 120)
);
--> statement-breakpoint
CREATE TABLE "expense_duplicate_override" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_duplicate_override_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"assessment_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"overridden_by_user_id" bigint NOT NULL,
	"overridden_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_duplicate_override_reason" CHECK (char_length("expense_duplicate_override"."reason") between 3 and 1000)
);
--> statement-breakpoint
CREATE TABLE "expense_duplicate_signal" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_duplicate_signal_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"assessment_id" bigint NOT NULL,
	"line_id" bigint NOT NULL,
	"matched_line_id" bigint,
	"signal_type" text NOT NULL,
	"signal_hash" text NOT NULL,
	"risk_points" integer NOT NULL,
	"detail" jsonb NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_duplicate_signal_type" CHECK ("expense_duplicate_signal"."signal_type" in ('file_hash','image_fingerprint','business_key')),
	CONSTRAINT "ck_expense_duplicate_signal_hash" CHECK (char_length("expense_duplicate_signal"."signal_hash") = 64 and "expense_duplicate_signal"."signal_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_expense_duplicate_signal_points" CHECK ("expense_duplicate_signal"."risk_points" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "expense_line_approval" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_line_approval_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"claim_id" bigint NOT NULL,
	"line_id" bigint NOT NULL,
	"claim_version" integer NOT NULL,
	"assessment_id" bigint NOT NULL,
	"approval_instance_id" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_line_approval_version" CHECK ("expense_line_approval"."claim_version" > 0),
	CONSTRAINT "ck_expense_line_approval_status" CHECK ("expense_line_approval"."status" in ('pending','approved','rejected','returned'))
);
--> statement-breakpoint
CREATE TABLE "expense_line_control_assessment" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_line_control_assessment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"master_fn" text NOT NULL,
	"company_fn" text NOT NULL,
	"claim_id" bigint NOT NULL,
	"line_id" bigint NOT NULL,
	"claim_version" integer NOT NULL,
	"control_policy_version_id" bigint NOT NULL,
	"duplicate_risk_score" integer NOT NULL,
	"duplicate_risk_level" text NOT NULL,
	"budget_action" text NOT NULL,
	"budget_version_id" bigint,
	"budget_line_id" bigint,
	"budget_amount" numeric(18, 4),
	"consumed_amount" numeric(18, 4) NOT NULL,
	"line_amount" numeric(18, 4) NOT NULL,
	"remaining_after" numeric(18, 4),
	"budget_breached" boolean NOT NULL,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_expense_line_control_version" CHECK ("expense_line_control_assessment"."claim_version" > 0),
	CONSTRAINT "ck_expense_line_control_duplicate_score" CHECK ("expense_line_control_assessment"."duplicate_risk_score" between 0 and 100),
	CONSTRAINT "ck_expense_line_control_duplicate_level" CHECK ("expense_line_control_assessment"."duplicate_risk_level" in ('none','low','medium','high')),
	CONSTRAINT "ck_expense_line_control_budget_action" CHECK ("expense_line_control_assessment"."budget_action" in ('warn','extra_approval','block')),
	CONSTRAINT "ck_expense_line_control_amounts" CHECK ("expense_line_control_assessment"."consumed_amount" >= 0 and "expense_line_control_assessment"."line_amount" > 0
      and ("expense_line_control_assessment"."budget_amount" is null or "expense_line_control_assessment"."budget_amount" >= 0))
);
--> statement-breakpoint
ALTER TABLE "approval_decision" DROP CONSTRAINT "ck_approval_decision_value";--> statement-breakpoint
ALTER TABLE "approval_instance" DROP CONSTRAINT "ck_approval_instance_status";--> statement-breakpoint
ALTER TABLE "approval_instance_event" DROP CONSTRAINT "ck_approval_instance_event_type";--> statement-breakpoint
ALTER TABLE "approval_instance_step" DROP CONSTRAINT "ck_approval_instance_step_status";--> statement-breakpoint
ALTER TABLE "expense_claim_event" DROP CONSTRAINT "ck_expense_claim_event_type";--> statement-breakpoint
ALTER TABLE "document_extraction" ADD COLUMN "visual_fingerprint" text;--> statement-breakpoint
ALTER TABLE "expense_claim_line" ADD COLUMN "merchant_tax_number" text;--> statement-breakpoint
ALTER TABLE "expense_control_policy_version" ADD CONSTRAINT "expense_control_policy_version_confirmed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_duplicate_override" ADD CONSTRAINT "expense_duplicate_override_assessment_id_expense_line_control_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."expense_line_control_assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_duplicate_override" ADD CONSTRAINT "expense_duplicate_override_overridden_by_user_id_app_user_user_id_fk" FOREIGN KEY ("overridden_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_duplicate_signal" ADD CONSTRAINT "expense_duplicate_signal_assessment_id_expense_line_control_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."expense_line_control_assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_duplicate_signal" ADD CONSTRAINT "expense_duplicate_signal_line_id_expense_claim_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."expense_claim_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_duplicate_signal" ADD CONSTRAINT "expense_duplicate_signal_matched_line_id_expense_claim_line_id_fk" FOREIGN KEY ("matched_line_id") REFERENCES "public"."expense_claim_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_approval" ADD CONSTRAINT "expense_line_approval_claim_id_expense_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_approval" ADD CONSTRAINT "expense_line_approval_line_id_expense_claim_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."expense_claim_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_approval" ADD CONSTRAINT "expense_line_approval_assessment_id_expense_line_control_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."expense_line_control_assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_approval" ADD CONSTRAINT "expense_line_approval_approval_instance_id_approval_instance_id_fk" FOREIGN KEY ("approval_instance_id") REFERENCES "public"."approval_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_control_assessment" ADD CONSTRAINT "expense_line_control_assessment_claim_id_expense_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_control_assessment" ADD CONSTRAINT "expense_line_control_assessment_line_id_expense_claim_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."expense_claim_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_control_assessment" ADD CONSTRAINT "expense_line_control_assessment_control_policy_version_id_expense_control_policy_version_id_fk" FOREIGN KEY ("control_policy_version_id") REFERENCES "public"."expense_control_policy_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_control_assessment" ADD CONSTRAINT "expense_line_control_assessment_budget_version_id_budget_version_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "public"."budget_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line_control_assessment" ADD CONSTRAINT "expense_line_control_assessment_budget_line_id_budget_line_id_fk" FOREIGN KEY ("budget_line_id") REFERENCES "public"."budget_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_control_policy_version" ON "expense_control_policy_version" USING btree ("master_fn","company_fn","policy_key","version_no");--> statement-breakpoint
CREATE INDEX "idx_expense_control_policy_effective" ON "expense_control_policy_version" USING btree ("master_fn","company_fn","status","valid_from","valid_to","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_duplicate_override" ON "expense_duplicate_override" USING btree ("master_fn","company_fn","assessment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_duplicate_signal" ON "expense_duplicate_signal" USING btree ("master_fn","company_fn","assessment_id","signal_type","matched_line_id");--> statement-breakpoint
CREATE INDEX "idx_expense_duplicate_signal_line" ON "expense_duplicate_signal" USING btree ("master_fn","company_fn","line_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_line_approval_line" ON "expense_line_approval" USING btree ("master_fn","company_fn","line_id","claim_version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_line_approval_instance" ON "expense_line_approval" USING btree ("master_fn","company_fn","approval_instance_id");--> statement-breakpoint
CREATE INDEX "idx_expense_line_approval_queue" ON "expense_line_approval" USING btree ("master_fn","company_fn","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_line_control_assessment" ON "expense_line_control_assessment" USING btree ("master_fn","company_fn","line_id","claim_version");--> statement-breakpoint
CREATE INDEX "idx_expense_line_control_risk" ON "expense_line_control_assessment" USING btree ("master_fn","company_fn","duplicate_risk_level","budget_breached","id");--> statement-breakpoint
ALTER TABLE "approval_decision" ADD CONSTRAINT "ck_approval_decision_value" CHECK ("approval_decision"."decision" in ('approved', 'rejected', 'returned'));--> statement-breakpoint
ALTER TABLE "approval_instance" ADD CONSTRAINT "ck_approval_instance_status" CHECK ("approval_instance"."status" in ('pending', 'approved', 'rejected', 'returned', 'cancelled'));--> statement-breakpoint
ALTER TABLE "approval_instance_event" ADD CONSTRAINT "ck_approval_instance_event_type" CHECK ("approval_instance_event"."event_type" in (
      'created', 'step_activated', 'reminder_sent', 'escalated',
      'step_approved', 'approved', 'rejected', 'returned', 'cancelled', 'capacity_evaluated'
    ));--> statement-breakpoint
ALTER TABLE "approval_instance_step" ADD CONSTRAINT "ck_approval_instance_step_status" CHECK ("approval_instance_step"."status" in ('waiting', 'pending', 'approved', 'rejected', 'returned', 'cancelled'));--> statement-breakpoint
ALTER TABLE "document_extraction" ADD CONSTRAINT "ck_document_extraction_visual_fingerprint" CHECK ("document_extraction"."visual_fingerprint" is null or (
      char_length("document_extraction"."visual_fingerprint") = 64
      and "document_extraction"."visual_fingerprint" ~ '^[0-9a-f]{64}$'
    ));--> statement-breakpoint
ALTER TABLE "expense_claim_line" ADD CONSTRAINT "ck_expense_claim_line_tax_number" CHECK ("expense_claim_line"."merchant_tax_number" is null
      or char_length("expense_claim_line"."merchant_tax_number") between 3 and 80);--> statement-breakpoint
ALTER TABLE "expense_claim_event" ADD CONSTRAINT "ck_expense_claim_event_type" CHECK ("expense_claim_event"."event_type" in (
      'created','draft_replaced','submitted','system_submitted','approval_updated'
    ));--> statement-breakpoint
INSERT INTO "role_permission" ("master_fn", "role_id", "permission_key", "allowed")
SELECT "master_fn", "role_id", 'expenses.approve.manager', true
FROM "role"
WHERE "name" = 'Manager'
ON CONFLICT ("role_id", "permission_key") DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permission" ("master_fn", "role_id", "permission_key", "allowed")
SELECT "master_fn", "role_id", permission_key, true
FROM "role"
CROSS JOIN (
  VALUES
    ('expenses.approve.finance'),
    ('expenses.approve.budget'),
    ('expenses.duplicate.override')
) AS permissions(permission_key)
WHERE "name" IN ('Finance', 'Finance Manager')
ON CONFLICT ("role_id", "permission_key") DO NOTHING;--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_expense_control_fact_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_control_policy_version_immutable
ON expense_control_policy_version;--> statement-breakpoint
CREATE TRIGGER expense_control_policy_version_immutable
BEFORE UPDATE OR DELETE ON expense_control_policy_version
FOR EACH ROW EXECUTE FUNCTION prevent_expense_control_fact_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_line_control_assessment_immutable
ON expense_line_control_assessment;--> statement-breakpoint
CREATE TRIGGER expense_line_control_assessment_immutable
BEFORE UPDATE OR DELETE ON expense_line_control_assessment
FOR EACH ROW EXECUTE FUNCTION prevent_expense_control_fact_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_duplicate_signal_immutable
ON expense_duplicate_signal;--> statement-breakpoint
CREATE TRIGGER expense_duplicate_signal_immutable
BEFORE UPDATE OR DELETE ON expense_duplicate_signal
FOR EACH ROW EXECUTE FUNCTION prevent_expense_control_fact_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_duplicate_override_immutable
ON expense_duplicate_override;--> statement-breakpoint
CREATE TRIGGER expense_duplicate_override_immutable
BEFORE UPDATE OR DELETE ON expense_duplicate_override
FOR EACH ROW EXECUTE FUNCTION prevent_expense_control_fact_mutation();--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_expense_line_approval_projection()
RETURNS trigger AS $$
BEGIN
  IF OLD.master_fn IS DISTINCT FROM NEW.master_fn
    OR OLD.company_fn IS DISTINCT FROM NEW.company_fn
    OR OLD.claim_id IS DISTINCT FROM NEW.claim_id
    OR OLD.line_id IS DISTINCT FROM NEW.line_id
    OR OLD.claim_version IS DISTINCT FROM NEW.claim_version
    OR OLD.assessment_id IS DISTINCT FROM NEW.assessment_id
    OR OLD.approval_instance_id IS DISTINCT FROM NEW.approval_instance_id
    OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'expense line approval identity is immutable';
  END IF;
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'terminal expense line approval cannot change';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_line_approval_projection
ON expense_line_approval;--> statement-breakpoint
CREATE TRIGGER expense_line_approval_projection
BEFORE UPDATE ON expense_line_approval
FOR EACH ROW EXECUTE FUNCTION enforce_expense_line_approval_projection();--> statement-breakpoint
DROP TRIGGER IF EXISTS expense_line_approval_no_delete
ON expense_line_approval;--> statement-breakpoint
CREATE TRIGGER expense_line_approval_no_delete
BEFORE DELETE ON expense_line_approval
FOR EACH ROW EXECUTE FUNCTION prevent_expense_control_fact_mutation();
