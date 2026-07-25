// Versioned, tenant-scoped approval governance shared by leave and future domains.
// Policies are immutable once confirmed; instances snapshot their resolved steps,
// while decisions/events/delegations remain append-only audit facts.
import {
  pgTable, text, bigint, integer, numeric, boolean, date, timestamp,
  index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { appUser } from './tenancy';
import { employee } from './hr';

export const approvalPolicy = pgTable('approval_policy', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_approval_policy_code').on(t.masterFn, t.companyFn, t.code),
  uniqueIndex('uq_approval_policy_scope_id').on(t.id, t.masterFn, t.companyFn),
  index('idx_approval_policy_domain').on(t.masterFn, t.companyFn, t.domain, t.isActive),
  check('ck_approval_policy_domain', sql`${t.domain} ~ '^[a-z][a-z0-9_]{0,47}$'`),
]);

/** Nullable condition columns mean “all”. Higher priority wins; equal-priority,
 * equally-specific matches are rejected by the resolver instead of guessed. */
export const approvalPolicyVersion = pgTable('approval_policy_version', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  policyId: bigint('policy_id', { mode: 'number' }).notNull()
    .references(() => approvalPolicy.id),
  versionNo: integer('version_no').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  status: text('status').notNull().default('draft'),
  priority: integer('priority').notNull().default(0),
  employeeId: bigint('employee_id', { mode: 'number' }).references(() => employee.id),
  department: text('department'),
  typeRef: text('type_ref'),
  minimumDays: numeric('minimum_days', { precision: 10, scale: 2 }),
  maximumDays: numeric('maximum_days', { precision: 10, scale: 2 }),
  minimumAmount: numeric('minimum_amount', { precision: 18, scale: 2 }),
  maximumAmount: numeric('maximum_amount', { precision: 18, scale: 2 }),
  currency: text('currency'),
  confirmedByUserId: bigint('confirmed_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_approval_policy_version')
    .on(t.masterFn, t.companyFn, t.policyId, t.versionNo),
  uniqueIndex('uq_approval_policy_version_scope_id').on(t.id, t.masterFn, t.companyFn),
  index('idx_approval_policy_version_resolution')
    .on(t.masterFn, t.companyFn, t.status, t.effectiveFrom, t.effectiveTo, t.priority),
  check('ck_approval_policy_version_no', sql`${t.versionNo} > 0`),
  check('ck_approval_policy_version_status', sql`${t.status} in ('draft', 'confirmed', 'retired')`),
  check(
    'ck_approval_policy_version_dates',
    sql`${t.effectiveTo} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`,
  ),
  check(
    'ck_approval_policy_version_days',
    sql`(${t.minimumDays} is null or ${t.minimumDays} >= 0)
      and (${t.maximumDays} is null or ${t.maximumDays} >= 0)
      and (${t.minimumDays} is null or ${t.maximumDays} is null or ${t.maximumDays} >= ${t.minimumDays})`,
  ),
  check(
    'ck_approval_policy_version_amounts',
    sql`(${t.minimumAmount} is null or ${t.minimumAmount} >= 0)
      and (${t.maximumAmount} is null or ${t.maximumAmount} >= 0)
      and (${t.minimumAmount} is null or ${t.maximumAmount} is null or ${t.maximumAmount} >= ${t.minimumAmount})`,
  ),
  check(
    'ck_approval_policy_version_currency',
    sql`${t.currency} is null or ${t.currency} ~ '^[A-Z]{3}$'`,
  ),
  check(
    'ck_approval_policy_version_confirmation',
    sql`(${t.status} = 'confirmed' and ${t.confirmedAt} is not null and ${t.confirmedByUserId} is not null)
      or (${t.status} <> 'confirmed')`,
  ),
]);

export const approvalPolicyStep = pgTable('approval_policy_step', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  policyVersionId: bigint('policy_version_id', { mode: 'number' }).notNull()
    .references(() => approvalPolicyVersion.id),
  stepNo: integer('step_no').notNull(),
  label: text('label').notNull(),
  authorityType: text('authority_type').notNull(),
  authorityEmployeeId: bigint('authority_employee_id', { mode: 'number' })
    .references(() => employee.id),
  authorityPermissionKey: text('authority_permission_key'),
  managerLevel: integer('manager_level').notNull().default(1),
  fallbackPermissionKey: text('fallback_permission_key'),
  reminderAfterHours: integer('reminder_after_hours'),
  escalateAfterHours: integer('escalate_after_hours'),
  escalationAuthorityType: text('escalation_authority_type'),
  escalationEmployeeId: bigint('escalation_employee_id', { mode: 'number' })
    .references(() => employee.id),
  escalationPermissionKey: text('escalation_permission_key'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_approval_policy_step')
    .on(t.masterFn, t.companyFn, t.policyVersionId, t.stepNo),
  index('idx_approval_policy_step_order')
    .on(t.masterFn, t.companyFn, t.policyVersionId, t.stepNo),
  check('ck_approval_policy_step_no', sql`${t.stepNo} > 0`),
  check(
    'ck_approval_policy_step_authority_type',
    sql`${t.authorityType} in ('direct_manager', 'permission', 'named_employee')`,
  ),
  check(
    'ck_approval_policy_step_authority_shape',
    sql`(${t.authorityType} = 'direct_manager'
        and ${t.authorityEmployeeId} is null
        and ${t.authorityPermissionKey} is null
        and ${t.managerLevel} > 0)
      or (${t.authorityType} = 'permission'
        and ${t.authorityEmployeeId} is null
        and ${t.authorityPermissionKey} is not null)
      or (${t.authorityType} = 'named_employee'
        and ${t.authorityEmployeeId} is not null
        and ${t.authorityPermissionKey} is null)`,
  ),
  check(
    'ck_approval_policy_step_timers',
    sql`(${t.reminderAfterHours} is null or ${t.reminderAfterHours} > 0)
      and (${t.escalateAfterHours} is null or ${t.escalateAfterHours} > 0)
      and (${t.reminderAfterHours} is null or ${t.escalateAfterHours} is null
        or ${t.escalateAfterHours} >= ${t.reminderAfterHours})`,
  ),
  check(
    'ck_approval_policy_step_escalation_type',
    sql`${t.escalationAuthorityType} is null
      or ${t.escalationAuthorityType} in ('permission', 'named_employee')`,
  ),
]);

export const approvalInstance = pgTable('approval_instance', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  domain: text('domain').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: bigint('entity_id', { mode: 'number' }).notNull(),
  entityVersion: integer('entity_version').notNull(),
  policyVersionId: bigint('policy_version_id', { mode: 'number' }).notNull()
    .references(() => approvalPolicyVersion.id),
  status: text('status').notNull().default('pending'),
  currentStepNo: integer('current_step_no').notNull().default(1),
  subjectEmployeeId: bigint('subject_employee_id', { mode: 'number' })
    .references(() => employee.id),
  submittedByUserId: bigint('submitted_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  department: text('department'),
  typeRef: text('type_ref'),
  days: numeric('days', { precision: 10, scale: 2 }),
  amount: numeric('amount', { precision: 18, scale: 2 }),
  currency: text('currency'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_approval_instance_entity_version')
    .on(t.masterFn, t.companyFn, t.domain, t.entityType, t.entityId, t.entityVersion),
  uniqueIndex('uq_approval_instance_scope_id').on(t.id, t.masterFn, t.companyFn),
  index('idx_approval_instance_status')
    .on(t.masterFn, t.companyFn, t.domain, t.status, t.currentStepNo, t.id),
  check('ck_approval_instance_entity_version', sql`${t.entityId} > 0 and ${t.entityVersion} > 0`),
  check('ck_approval_instance_status',
    sql`${t.status} in ('pending', 'approved', 'rejected', 'returned', 'cancelled')`),
  check('ck_approval_instance_current_step', sql`${t.currentStepNo} > 0`),
]);

/** Original authority columns never change. Current authority is only the
 * workflow projection after an explicit escalation event. */
export const approvalInstanceStep = pgTable('approval_instance_step', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  instanceId: bigint('instance_id', { mode: 'number' }).notNull()
    .references(() => approvalInstance.id),
  policyStepId: bigint('policy_step_id', { mode: 'number' })
    .references(() => approvalPolicyStep.id),
  stepNo: integer('step_no').notNull(),
  label: text('label').notNull(),
  status: text('status').notNull().default('waiting'),
  originalAuthorityType: text('original_authority_type').notNull(),
  originalAuthorityEmployeeId: bigint('original_authority_employee_id', { mode: 'number' })
    .references(() => employee.id),
  originalAuthorityUserId: bigint('original_authority_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  originalAuthorityPermissionKey: text('original_authority_permission_key'),
  currentAuthorityType: text('current_authority_type').notNull(),
  currentAuthorityEmployeeId: bigint('current_authority_employee_id', { mode: 'number' })
    .references(() => employee.id),
  currentAuthorityUserId: bigint('current_authority_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  currentAuthorityPermissionKey: text('current_authority_permission_key'),
  escalationAuthorityType: text('escalation_authority_type'),
  escalationAuthorityEmployeeId: bigint('escalation_authority_employee_id', { mode: 'number' })
    .references(() => employee.id),
  escalationAuthorityUserId: bigint('escalation_authority_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  escalationAuthorityPermissionKey: text('escalation_authority_permission_key'),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  reminderDueAt: timestamp('reminder_due_at', { withTimezone: true }),
  escalationDueAt: timestamp('escalation_due_at', { withTimezone: true }),
  remindedAt: timestamp('reminded_at', { withTimezone: true }),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_approval_instance_step')
    .on(t.masterFn, t.companyFn, t.instanceId, t.stepNo),
  uniqueIndex('uq_approval_instance_step_scope_id').on(t.id, t.masterFn, t.companyFn),
  index('idx_approval_instance_step_queue')
    .on(t.masterFn, t.companyFn, t.status, t.currentAuthorityUserId, t.id),
  check('ck_approval_instance_step_no', sql`${t.stepNo} > 0`),
  check('ck_approval_instance_step_status',
    sql`${t.status} in ('waiting', 'pending', 'approved', 'rejected', 'returned', 'cancelled')`),
  check(
    'ck_approval_instance_step_authority_type',
    sql`${t.originalAuthorityType} in ('employee', 'permission')
      and ${t.currentAuthorityType} in ('employee', 'permission')
      and (${t.escalationAuthorityType} is null
        or ${t.escalationAuthorityType} in ('employee', 'permission'))`,
  ),
]);

/** Time-bounded authority; revocation closes future use without changing decisions. */
export const approvalDelegation = pgTable('approval_delegation', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  domain: text('domain'),
  authorityEmployeeId: bigint('authority_employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  delegateEmployeeId: bigint('delegate_employee_id', { mode: 'number' }).notNull()
    .references(() => employee.id),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }).notNull(),
  reason: text('reason').notNull(),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedByUserId: bigint('revoked_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  index('idx_approval_delegation_authority')
    .on(t.masterFn, t.companyFn, t.authorityEmployeeId, t.validFrom, t.validTo),
  index('idx_approval_delegation_delegate')
    .on(t.masterFn, t.companyFn, t.delegateEmployeeId, t.validFrom, t.validTo),
  check('ck_approval_delegation_distinct', sql`${t.authorityEmployeeId} <> ${t.delegateEmployeeId}`),
  check('ck_approval_delegation_dates', sql`${t.validTo} > ${t.validFrom}`),
  check('ck_approval_delegation_reason', sql`char_length(trim(${t.reason})) between 3 and 500`),
  check(
    'ck_approval_delegation_revocation',
    sql`(${t.revokedAt} is null and ${t.revokedByUserId} is null)
      or (${t.revokedAt} is not null and ${t.revokedByUserId} is not null)`,
  ),
]);

export const approvalDecision = pgTable('approval_decision', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  instanceId: bigint('instance_id', { mode: 'number' }).notNull()
    .references(() => approvalInstance.id),
  stepId: bigint('step_id', { mode: 'number' }).notNull()
    .references(() => approvalInstanceStep.id),
  decision: text('decision').notNull(),
  reason: text('reason'),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  actorEmployeeId: bigint('actor_employee_id', { mode: 'number' })
    .references(() => employee.id),
  authoritySource: text('authority_source').notNull(),
  originalAuthorityType: text('original_authority_type').notNull(),
  originalAuthorityEmployeeId: bigint('original_authority_employee_id', { mode: 'number' })
    .references(() => employee.id),
  originalAuthorityUserId: bigint('original_authority_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  originalAuthorityPermissionKey: text('original_authority_permission_key'),
  delegationId: bigint('delegation_id', { mode: 'number' })
    .references(() => approvalDelegation.id),
  eventKey: text('event_key').notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_approval_decision_step').on(t.masterFn, t.companyFn, t.stepId),
  uniqueIndex('uq_approval_decision_event_key').on(t.masterFn, t.companyFn, t.eventKey),
  index('idx_approval_decision_history').on(t.masterFn, t.companyFn, t.instanceId, t.id),
  check('ck_approval_decision_value',
    sql`${t.decision} in ('approved', 'rejected', 'returned')`),
  check(
    'ck_approval_decision_authority_source',
    sql`${t.authoritySource} in ('direct', 'delegated', 'permission', 'escalated')`,
  ),
]);

export const approvalInstanceEvent = pgTable('approval_instance_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  instanceId: bigint('instance_id', { mode: 'number' }).notNull()
    .references(() => approvalInstance.id),
  stepId: bigint('step_id', { mode: 'number' }).references(() => approvalInstanceStep.id),
  eventType: text('event_type').notNull(),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).references(() => appUser.userId),
  detail: text('detail'),
  eventKey: text('event_key').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_approval_instance_event_key').on(t.masterFn, t.companyFn, t.eventKey),
  index('idx_approval_instance_event_history')
    .on(t.masterFn, t.companyFn, t.instanceId, t.id),
  check(
    'ck_approval_instance_event_type',
    sql`${t.eventType} in (
      'created', 'step_activated', 'reminder_sent', 'escalated',
      'step_approved', 'approved', 'rejected', 'returned', 'cancelled', 'capacity_evaluated'
    )`,
  ),
]);

export const leaveCapacityRule = pgTable('leave_capacity_rule', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  department: text('department'),
  typeRef: text('type_ref'),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  minimumStaff: integer('minimum_staff').notNull(),
  action: text('action').notNull(),
  priority: integer('priority').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  extraApprovalPermissionKey: text('extra_approval_permission_key'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_leave_capacity_rule_code').on(t.masterFn, t.companyFn, t.code),
  index('idx_leave_capacity_rule_resolution')
    .on(t.masterFn, t.companyFn, t.isActive, t.effectiveFrom, t.effectiveTo, t.priority),
  check('ck_leave_capacity_rule_dates', sql`${t.effectiveTo} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`),
  check('ck_leave_capacity_rule_staff', sql`${t.minimumStaff} >= 0`),
  check('ck_leave_capacity_rule_action', sql`${t.action} in ('warn', 'extra_approval', 'block')`),
  check(
    'ck_leave_capacity_rule_extra',
    sql`${t.action} <> 'extra_approval' or ${t.extraApprovalPermissionKey} is not null`,
  ),
]);

/** Every submit/final-decision evaluation is retained; the newest row is the
 * current capacity evidence, not a mutable counter. */
export const approvalCapacitySnapshot = pgTable('approval_capacity_snapshot', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  instanceId: bigint('instance_id', { mode: 'number' }).notNull()
    .references(() => approvalInstance.id),
  ruleId: bigint('rule_id', { mode: 'number' }).references(() => leaveCapacityRule.id),
  evaluationStage: text('evaluation_stage').notNull(),
  action: text('action').notNull(),
  minimumStaff: integer('minimum_staff').notNull(),
  activeStaff: integer('active_staff').notNull(),
  unavailableStaff: integer('unavailable_staff').notNull(),
  remainingStaff: integer('remaining_staff').notNull(),
  breached: boolean('breached').notNull(),
  eventKey: text('event_key').notNull(),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_approval_capacity_snapshot_key').on(t.masterFn, t.companyFn, t.eventKey),
  index('idx_approval_capacity_snapshot_history')
    .on(t.masterFn, t.companyFn, t.instanceId, t.id),
  check('ck_approval_capacity_snapshot_stage', sql`${t.evaluationStage} in ('submission', 'final_approval')`),
  check('ck_approval_capacity_snapshot_action', sql`${t.action} in ('none', 'warn', 'extra_approval', 'block')`),
  check(
    'ck_approval_capacity_snapshot_counts',
    sql`${t.minimumStaff} >= 0 and ${t.activeStaff} >= 0
      and ${t.unavailableStaff} >= 0`,
  ),
]);
