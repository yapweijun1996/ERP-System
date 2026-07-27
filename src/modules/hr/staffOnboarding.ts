import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  appUser, employee, employeeActivationSecret, leavePolicyVersion, leaveType,
  role, staffOnboardingDraft, userCompany, userCompanyRole,
} from '../../data/schema';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { appendAudit } from '../../api/audit';
import type { SessionData } from '../../auth/session';
import { isValidUsername, normalizeUsername } from '../../auth/identifiers';
import { createEmployeeWithin, type CreateEmployeeInput } from './employee';
import { appendLeaveBalanceEntryWithin } from './leaveBalance';

export interface StaffOnboardingDraftInput {
  employee: CreateEmployeeInput;
  username: string;
  email: string;
  roleIds: number[];
}

export interface StaffOnboardingDraftRecord {
  id: number;
  status: string;
  employee: CreateEmployeeInput;
  username: string;
  email: string;
  roleIds: number[];
  version: number;
}

export class StaffOnboardingError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'StaffOnboardingError';
  }
}

function normalizeDraft(input: StaffOnboardingDraftInput) {
  const username = normalizeUsername(input.username ?? '');
  const email = input.email?.trim().toLowerCase();
  const roleIds = [...new Set(input.roleIds ?? [])].sort((a, b) => a - b);
  const errors: Record<string, string> = {};
  if (!isValidUsername(username)) errors.username = 'Use a valid organization username.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid work email.';
  if (!roleIds.length || roleIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    errors.roleIds = 'Select at least one valid company role.';
  }
  if (!input.employee || typeof input.employee !== 'object') errors.employee = 'Employee details are required.';
  if (Object.keys(errors).length) {
    throw new StaffOnboardingError(400, 'invalid_staff_draft', 'Complete all staff details.', errors);
  }
  return { employee: input.employee, username, email, roleIds };
}

async function assertCompanyRoles(exec: DB, session: SessionData, roleIds: number[]) {
  const rows = await exec.select({ id: role.roleId }).from(role).where(and(
    eq(role.masterFn, session.masterFn),
    eq(role.companyFn, session.activeCompanyFn),
    inArray(role.roleId, roleIds),
  ));
  if (rows.length !== roleIds.length) {
    throw new StaffOnboardingError(400, 'invalid_company_role', 'One or more roles do not belong to this company.');
  }
}

export async function createStaffOnboardingDraftWithin(
  exec: DB,
  session: SessionData,
  input: StaffOnboardingDraftInput,
  requestId: string,
) {
  const value = normalizeDraft(input);
  await assertCompanyRoles(exec, session, value.roleIds);
  const [created] = await exec.insert(staffOnboardingDraft).values({
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    employeeData: value.employee,
    username: value.username,
    email: value.email,
    roleIds: value.roleIds,
    createdByUserId: session.userId,
  }).returning({ id: staffOnboardingDraft.id, version: staffOnboardingDraft.version });
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'staff_onboarding_draft',
    entityId: created.id,
    action: 'created',
    after: { username: value.username, email: value.email, roleIds: value.roleIds },
  });
  return { id: created.id, version: created.version, status: 'draft' as const };
}

export function createStaffOnboardingDraft(
  db: DB,
  session: SessionData,
  input: StaffOnboardingDraftInput,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
  }, (tx) => createStaffOnboardingDraftWithin(tx, session, input, requestId));
}

export async function listStaffOnboardingDrafts(
  exec: DB,
  session: SessionData,
): Promise<StaffOnboardingDraftRecord[]> {
  const rows = await exec.select().from(staffOnboardingDraft).where(and(
    eq(staffOnboardingDraft.masterFn, session.masterFn),
    eq(staffOnboardingDraft.companyFn, session.activeCompanyFn),
  )).orderBy(desc(staffOnboardingDraft.id));
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    employee: row.employeeData as unknown as CreateEmployeeInput,
    username: row.username,
    email: row.email,
    roleIds: row.roleIds as number[],
    version: row.version,
  }));
}

export async function updateStaffOnboardingDraftWithin(
  exec: DB,
  session: SessionData,
  draftId: number,
  expectedVersion: number,
  input: StaffOnboardingDraftInput,
  requestId: string,
) {
  const value = normalizeDraft(input);
  await assertCompanyRoles(exec, session, value.roleIds);
  const [current] = await exec.select().from(staffOnboardingDraft).where(and(
    eq(staffOnboardingDraft.id, draftId),
    eq(staffOnboardingDraft.masterFn, session.masterFn),
    eq(staffOnboardingDraft.companyFn, session.activeCompanyFn),
  )).limit(1).for('update');
  if (!current) throw new StaffOnboardingError(404, 'staff_draft_not_found', 'Staff draft not found.');
  if (current.status !== 'draft') throw new StaffOnboardingError(409, 'staff_draft_closed', 'Staff draft is already closed.');
  if (current.version !== expectedVersion) throw new StaffOnboardingError(409, 'version_conflict', 'Reload the staff draft and try again.');
  const [updated] = await exec.update(staffOnboardingDraft).set({
    employeeData: value.employee,
    username: value.username,
    email: value.email,
    roleIds: value.roleIds,
    version: current.version + 1,
    updatedAt: new Date(),
  }).where(eq(staffOnboardingDraft.id, draftId)).returning({ version: staffOnboardingDraft.version });
  await appendAudit(exec, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
    actorUserId: session.userId, requestId,
    entity: 'staff_onboarding_draft', entityId: draftId, action: 'updated',
    after: { username: value.username, roleIds: value.roleIds, version: updated.version },
  });
  return { id: draftId, status: 'draft' as const, version: updated.version };
}

export function updateStaffOnboardingDraft(
  db: DB,
  session: SessionData,
  draftId: number,
  expectedVersion: number,
  input: StaffOnboardingDraftInput,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
  }, (tx) => updateStaffOnboardingDraftWithin(
    tx, session, draftId, expectedVersion, input, requestId,
  ));
}

export async function activateStaffOnboardingWithin(
  exec: DB,
  session: SessionData,
  draftId: number,
  expectedVersion: number,
  passwordHash: string | null,
  requestId: string,
  now = new Date(),
) {
  const [draft] = await exec.select().from(staffOnboardingDraft).where(and(
    eq(staffOnboardingDraft.id, draftId),
    eq(staffOnboardingDraft.masterFn, session.masterFn),
    eq(staffOnboardingDraft.companyFn, session.activeCompanyFn),
  )).limit(1).for('update');
  if (!draft) throw new StaffOnboardingError(404, 'staff_draft_not_found', 'Staff draft not found.');
  if (draft.status !== 'draft') throw new StaffOnboardingError(409, 'staff_draft_closed', 'Staff draft is already closed.');
  if (draft.version !== expectedVersion) throw new StaffOnboardingError(409, 'version_conflict', 'Reload the staff draft and try again.');
  const roleIds = draft.roleIds as number[];
  await assertCompanyRoles(exec, session, roleIds);
  const employeeInput = draft.employeeData as unknown as CreateEmployeeInput;
  const [existingEmployee] = await exec.select({ id: employee.id }).from(employee).where(and(
    eq(employee.masterFn, session.masterFn),
    eq(employee.companyFn, session.activeCompanyFn),
    eq(employee.employeeNo, employeeInput.employeeNo.trim()),
  )).limit(1);
  if (existingEmployee) throw new StaffOnboardingError(409, 'employee_exists', 'Employee number already exists.');

  const [existingUser] = await exec.select().from(appUser).where(and(
    eq(appUser.masterFn, session.masterFn),
    eq(appUser.username, draft.username),
  )).limit(1);
  let userId: number;
  let newCredential = false;
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (existingUser) {
    if (existingUser.email?.toLowerCase() !== draft.email.toLowerCase() || !existingUser.isActive) {
      throw new StaffOnboardingError(409, 'identity_conflict', 'Username belongs to another or inactive identity.');
    }
    const [membership] = await exec.select({ userId: userCompany.userId }).from(userCompany).where(and(
      eq(userCompany.userId, existingUser.userId),
      eq(userCompany.companyFn, session.activeCompanyFn),
    )).limit(1);
    if (membership) throw new StaffOnboardingError(409, 'company_membership_exists', 'This user already belongs to the company.');
    userId = existingUser.userId;
  } else {
    if (!passwordHash?.startsWith('pbkdf2$')) {
      throw new StaffOnboardingError(
        400,
        'initial_password_required',
        'An initial password is required for a new identity.',
        { initialPassword: 'Use at least 8 characters.' },
      );
    }
    const [createdUser] = await exec.insert(appUser).values({
      masterFn: session.masterFn,
      username: draft.username,
      email: draft.email,
      fullName: employeeInput.fullName.trim(),
      passwordHash,
      language: 'en',
      isActive: true,
      accountState: 'preactivated',
      passwordChangeRequired: true,
      initialPasswordExpiresAt: expiresAt,
    }).returning({ id: appUser.userId });
    userId = createdUser.id;
    newCredential = true;
  }
  const createdEmployee = await createEmployeeWithin(exec, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
  }, employeeInput);
  await exec.update(employee).set({ userId, updatedAt: now }).where(eq(employee.id, createdEmployee.id));
  const [employeeBaseRole] = await exec.select({ id: role.roleId }).from(role).where(and(
    eq(role.masterFn, session.masterFn),
    eq(role.companyFn, session.activeCompanyFn),
    eq(role.name, 'Employee'),
  )).limit(1);
  const allRoleIds = [...new Set([...roleIds, ...(employeeBaseRole ? [employeeBaseRole.id] : [])])];
  await exec.insert(userCompany).values({
    userId, companyFn: session.activeCompanyFn, roleId: allRoleIds[0],
  });
  await exec.insert(userCompanyRole).values(allRoleIds.map((roleId) => ({
    userId, companyFn: session.activeCompanyFn, roleId,
  })));
  if (newCredential) {
    await exec.insert(employeeActivationSecret).values({
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
      employeeId: createdEmployee.id,
      userId,
      purpose: 'activation',
      generation: 1,
      credentialEnvelope: null,
      expiresAt,
      createdByUserId: session.userId,
    });
  }

  const [annual] = await exec.select({
    leaveTypeId: leaveType.id,
    policyVersionId: leavePolicyVersion.id,
  }).from(leaveType).innerJoin(leavePolicyVersion, and(
    eq(leavePolicyVersion.leaveTypeId, leaveType.id),
    eq(leavePolicyVersion.masterFn, leaveType.masterFn),
    eq(leavePolicyVersion.companyFn, leaveType.companyFn),
  )).where(and(
    eq(leaveType.masterFn, session.masterFn),
    eq(leaveType.companyFn, session.activeCompanyFn),
    eq(leaveType.code, 'ANNUAL'),
    eq(leavePolicyVersion.status, 'confirmed'),
  )).orderBy(desc(leavePolicyVersion.effectiveFrom)).limit(1);
  if (annual && (employeeInput.annualLeaveDays ?? 14) > 0) {
    await appendLeaveBalanceEntryWithin(exec, {
      masterFn: session.masterFn, companyFn: session.activeCompanyFn,
    }, {
      employeeId: createdEmployee.id,
      leaveTypeId: annual.leaveTypeId,
      policyVersionId: annual.policyVersionId,
      entryType: 'grant',
      entryKey: `staff-onboarding:${draftId}:annual`,
      balanceDelta: employeeInput.annualLeaveDays ?? 14,
      reservedDelta: 0,
      effectiveDate: employeeInput.startDate,
      sourceType: 'staff_onboarding',
      sourceId: String(draftId),
      note: 'Opening annual leave entitlement',
      createdByUserId: session.userId,
    });
  }
  await exec.update(staffOnboardingDraft).set({
    status: 'activated',
    activatedUserId: userId,
    activatedAt: now,
    version: draft.version + 1,
    updatedAt: now,
  }).where(eq(staffOnboardingDraft.id, draft.id));
  await appendAudit(exec, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
    actorUserId: session.userId, requestId,
    entity: 'staff_onboarding_draft', entityId: draft.id, action: 'activated',
    after: { employeeId: createdEmployee.id, userId, roleIds: allRoleIds, newCredential },
  });
  return {
    draftId: draft.id,
    employeeId: createdEmployee.id,
    userId,
    username: draft.username,
    roleIds: allRoleIds,
    passwordExpiresAt: newCredential ? expiresAt : null,
    passwordChangeRequired: newCredential,
  };
}

export function activateStaffOnboarding(
  db: DB,
  session: SessionData,
  draftId: number,
  expectedVersion: number,
  passwordHash: string | null,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
  }, (tx) => activateStaffOnboardingWithin(
    tx, session, draftId, expectedVersion, passwordHash, requestId,
  ));
}
