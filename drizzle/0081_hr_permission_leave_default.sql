-- Route the active standard short-leave policy through HR permission authority.
-- This is intentionally a data-only transition: confirmed policy rows and
-- existing leave requests remain in place, while current pending standard
-- leave steps receive the new actionable authority projection.
UPDATE "approval_policy_step" AS step
SET
  "label" = 'HR approval',
  "authority_type" = 'permission',
  "authority_employee_id" = NULL,
  "authority_permission_key" = 'hr.write',
  "fallback_permission_key" = NULL,
  "reminder_after_hours" = NULL,
  "escalate_after_hours" = NULL,
  "escalation_authority_type" = NULL,
  "escalation_employee_id" = NULL,
  "escalation_permission_key" = NULL,
  "updated_at" = NOW()
FROM "approval_policy_version" AS version
JOIN "approval_policy" AS policy ON policy.id = version.policy_id
WHERE step.policy_version_id = version.id
  AND policy.domain = 'leave'
  AND policy.code = 'LEAVE-DEFAULT'
  AND version.status = 'confirmed'
  AND version.effective_to IS NULL
  AND step.authority_type = 'direct_manager';
--> statement-breakpoint

-- Keep original authority fields as historical facts. Only the current
-- pending projection changes, so an in-flight short leave becomes actionable
-- by the HR permission group without rewriting its audit history.
UPDATE "approval_instance_step" AS step
SET
  "label" = 'HR approval',
  "current_authority_type" = 'permission',
  "current_authority_employee_id" = NULL,
  "current_authority_user_id" = NULL,
  "current_authority_permission_key" = 'hr.write',
  "reminder_due_at" = NULL,
  "escalation_due_at" = NULL,
  "reminded_at" = NULL,
  "escalated_at" = NULL,
  "updated_at" = NOW()
FROM "approval_instance" AS instance
JOIN "approval_policy_version" AS version ON version.id = instance.policy_version_id
JOIN "approval_policy" AS policy ON policy.id = version.policy_id
WHERE step.instance_id = instance.id
  AND step.step_no = instance.current_step_no
  AND step.status = 'pending'
  AND instance.status = 'pending'
  AND instance.domain = 'leave'
  AND policy.domain = 'leave'
  AND policy.code = 'LEAVE-DEFAULT'
  AND version.status = 'confirmed'
  AND version.effective_to IS NULL
  AND step.current_authority_type = 'employee';
