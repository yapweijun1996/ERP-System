import {
  and, eq, inArray, isNull, ne, notInArray,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  appNotification,
  appSession,
  appUser,
  auditLog,
  customer,
  employee,
  employeeAccountHandoff,
  employeeActivationSecret,
  opportunity,
  role,
  rolePermission,
  roleResourceScope,
  userCompany,
  userCompanyRole,
} from '../../data/schema';
import type { EncryptedToken } from '../../auth/tokenCrypto';
import { isCompanyOwnerRole } from '../../auth/accessCatalog';
import { PERMISSIONS } from '../../auth/permissions';
import { ensureManagerRoleWithin, syncManagerRolesWithin } from './managerRole';

export const EMPLOYEE_ACCOUNT_STATES = ['preactivated', 'active', 'offboarded'] as const;
export type EmployeeAccountState = typeof EMPLOYEE_ACCOUNT_STATES[number];

export class EmployeeAccountError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'EmployeeAccountError';
  }
}

export interface EmployeeAccountScope {
  masterFn: string;
  companyFn: string;
}

export async function readEmployeeAccount(
  db: DB,
  scope: EmployeeAccountScope,
  employeeId: number,
) {
  const [row] = await db.select({
    employeeId: employee.id,
    employeeNo: employee.employeeNo,
    employeeName: employee.fullName,
    employeeActive: employee.isActive,
    managerId: employee.managerId,
    userId: appUser.userId,
    username: appUser.username,
    email: appUser.email,
    accountState: appUser.accountState,
    passwordChangeRequired: appUser.passwordChangeRequired,
    activatedAt: appUser.activatedAt,
    offboardedAt: appUser.offboardedAt,
  }).from(employee)
    .leftJoin(appUser, eq(appUser.userId, employee.userId))
    .where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.id, employeeId),
    ))
    .limit(1);
  if (!row) throw new EmployeeAccountError('employee_not_found', 'Employee not found.', 404);

  let secret: {
    purpose: string;
    generation: number;
    expiresAt: Date;
    clearedAt: Date | null;
  } | null = null;
  if (row.userId) {
    [secret = null] = await db.select({
      purpose: employeeActivationSecret.purpose,
      generation: employeeActivationSecret.generation,
      expiresAt: employeeActivationSecret.expiresAt,
      clearedAt: employeeActivationSecret.clearedAt,
    }).from(employeeActivationSecret).where(and(
      eq(employeeActivationSecret.masterFn, scope.masterFn),
      eq(employeeActivationSecret.companyFn, scope.companyFn),
      eq(employeeActivationSecret.userId, row.userId),
      isNull(employeeActivationSecret.clearedAt),
    )).limit(1);
  }
  return { ...row, temporaryCredential: secret };
}

export interface CreateEmployeeAccountInput {
  employeeId: number;
  username: string;
  passwordHash: string;
  credentialEnvelope: EncryptedToken;
  expiresAt: Date;
  actorUserId: number;
  requestId?: string;
}

const EMPLOYEE_ROLE_PERMISSION_KEYS = [
  PERMISSIONS.employeeSelfRead,
  PERMISSIONS.employeeLeaveWrite,
  PERMISSIONS.employeeReceiptsWrite,
  PERMISSIONS.expensesCompanyReceiptsReadOwn,
  PERMISSIONS.employeeClaimsWrite,
  PERMISSIONS.employeePayoutManage,
] as const;

const EMPLOYEE_ROLE_NAME = 'Employee';

async function assertCanonicalEmployeeRole(
  exec: DB,
  scope: EmployeeAccountScope,
  employeeRole: { roleId: number; isSuperadmin: boolean; sourceTemplateKey: string | null },
) {
  if (employeeRole.isSuperadmin || isCompanyOwnerRole(employeeRole.sourceTemplateKey)) {
    throw new EmployeeAccountError(
      'employee_role_misconfigured',
      'The Employee role is privileged and cannot be used for employee accounts.',
      503,
    );
  }

  const permissions = await exec.select({
    permissionKey: rolePermission.permissionKey,
    allowed: rolePermission.allowed,
  }).from(rolePermission).where(eq(rolePermission.roleId, employeeRole.roleId));
  const permissionContractValid = permissions.length === EMPLOYEE_ROLE_PERMISSION_KEYS.length
    && permissions.every((row) => row.allowed)
    && EMPLOYEE_ROLE_PERMISSION_KEYS.every((permissionKey) =>
      permissions.some((row) => row.permissionKey === permissionKey));

  const scopes = await exec.select({
    resourceKey: roleResourceScope.resourceKey,
    scope: roleResourceScope.scope,
  }).from(roleResourceScope).where(and(
    eq(roleResourceScope.masterFn, scope.masterFn),
    eq(roleResourceScope.companyFn, scope.companyFn),
    eq(roleResourceScope.roleId, employeeRole.roleId),
  ));
  const scopeContractValid = scopes.length === 1
    && scopes[0].resourceKey === 'employee/*'
    && scopes[0].scope === 'self';

  if (!permissionContractValid || !scopeContractValid) {
    throw new EmployeeAccountError(
      'employee_role_misconfigured',
      'The Employee role does not match the canonical employee access contract.',
      503,
    );
  }
}

/**
 * Employee is a system-managed base role, not a role-template choice for an
 * administrator. Older production databases can still be missing it (or a
 * company-scoped copy), so account provisioning repairs the exact prerequisite
 * it needs inside the same transaction as the account link.
 */
export async function ensureEmployeeRoleWithin(
  exec: DB,
  scope: EmployeeAccountScope,
  actorUserId: number,
  requestId?: string,
) {
  let [employeeRole] = await exec.select({
    roleId: role.roleId,
    isSuperadmin: role.isSuperadmin,
    sourceTemplateKey: role.sourceTemplateKey,
  }).from(role).where(and(
    eq(role.masterFn, scope.masterFn),
    eq(role.companyFn, scope.companyFn),
    eq(role.name, EMPLOYEE_ROLE_NAME),
  )).limit(1);

  if (!employeeRole) {
    const [createdRole] = await exec.insert(role).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      name: EMPLOYEE_ROLE_NAME,
      isSuperadmin: false,
      sourceTemplateKey: 'employee',
    }).onConflictDoNothing({
      target: [role.masterFn, role.companyFn, role.name],
    }).returning({ roleId: role.roleId });

    if (createdRole) {
      await exec.insert(rolePermission).values(EMPLOYEE_ROLE_PERMISSION_KEYS.map((permissionKey) => ({
        masterFn: scope.masterFn,
        roleId: createdRole.roleId,
        permissionKey,
      })));
      await exec.insert(roleResourceScope).values({
        masterFn: scope.masterFn,
        companyFn: scope.companyFn,
        roleId: createdRole.roleId,
        resourceKey: 'employee/*',
        scope: 'self',
      });
      if (requestId) {
        await exec.insert(auditLog).values({
          ...scope,
          actorUserId,
          requestId,
          entity: 'role',
          entityId: String(createdRole.roleId),
          action: 'created_system_employee_role',
          after: {
            name: EMPLOYEE_ROLE_NAME,
            permissions: EMPLOYEE_ROLE_PERMISSION_KEYS,
            scopes: { 'employee/*': 'self' },
          },
        });
      }
      return createdRole;
    }

    // A concurrent provision may have created the role after the first read.
    [employeeRole] = await exec.select({
      roleId: role.roleId,
      isSuperadmin: role.isSuperadmin,
      sourceTemplateKey: role.sourceTemplateKey,
    }).from(role).where(and(
      eq(role.masterFn, scope.masterFn),
      eq(role.companyFn, scope.companyFn),
      eq(role.name, EMPLOYEE_ROLE_NAME),
    )).limit(1);
  }

  if (!employeeRole) {
    throw new EmployeeAccountError('employee_role_missing', 'The Employee role is not configured.', 503);
  }
  await assertCanonicalEmployeeRole(exec, scope, employeeRole);
  return employeeRole;
}

export async function createEmployeeAccount(
  db: DB,
  scope: EmployeeAccountScope,
  input: CreateEmployeeAccountInput,
) {
  return db.transaction(async (tx) => {
    const [employeeRow] = await tx.select().from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.id, input.employeeId),
    )).limit(1);
    if (!employeeRow) throw new EmployeeAccountError('employee_not_found', 'Employee not found.', 404);
    if (!employeeRow.isActive) {
      throw new EmployeeAccountError('employee_inactive', 'An inactive employee cannot receive an account.', 409);
    }
    if (employeeRow.userId) {
      throw new EmployeeAccountError('employee_account_exists', 'This employee already has an account.', 409);
    }
    const [duplicate] = await tx.select({ userId: appUser.userId }).from(appUser).where(and(
      eq(appUser.masterFn, scope.masterFn),
      eq(appUser.username, input.username),
    )).limit(1);
    if (duplicate) {
      throw new EmployeeAccountError('username_taken', 'Username is already used in this organization.', 409, {
        username: 'Choose another username.',
      });
    }
    const employeeRole = await ensureEmployeeRoleWithin(
      tx,
      scope,
      input.actorUserId,
      input.requestId,
    );
    const [user] = await tx.insert(appUser).values({
      masterFn: scope.masterFn,
      username: input.username,
      email: null,
      fullName: employeeRow.fullName,
      passwordHash: input.passwordHash,
      language: 'en',
      isActive: true,
      accountState: 'preactivated',
      passwordChangeRequired: true,
      initialPasswordExpiresAt: input.expiresAt,
    }).returning({ userId: appUser.userId });
    await tx.insert(userCompany).values({
      userId: user.userId,
      companyFn: scope.companyFn,
      roleId: employeeRole.roleId,
    });
    await tx.insert(userCompanyRole).values({
      userId: user.userId,
      companyFn: scope.companyFn,
      roleId: employeeRole.roleId,
      managedBySystem: true,
      assignedByUserId: input.actorUserId,
      assignmentSource: 'system',
    });
    await tx.update(employee).set({
      userId: user.userId,
      updatedAt: new Date(),
    }).where(eq(employee.id, employeeRow.id));
    const [directReport] = await tx.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.managerId, employeeRow.id),
      eq(employee.isActive, true),
    )).limit(1);
    if (directReport) {
      await ensureManagerRoleWithin(tx, scope, input.actorUserId, input.requestId);
    }
    await syncManagerRolesWithin(tx, scope, [employeeRow.id]);
    await tx.insert(employeeActivationSecret).values({
      ...scope,
      employeeId: employeeRow.id,
      userId: user.userId,
      purpose: 'activation',
      generation: 1,
      credentialEnvelope: input.credentialEnvelope,
      expiresAt: input.expiresAt,
      createdByUserId: input.actorUserId,
    });
    if (input.requestId) {
      await tx.insert(auditLog).values({
        ...scope,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        entity: 'employee_account',
        entityId: String(employeeRow.id),
        action: 'created',
        after: { userId: user.userId, username: input.username, temporaryCredential: 'encrypted' },
      });
    }
    return { employeeId: employeeRow.id, userId: user.userId, username: input.username };
  });
}

export async function activeEmployeeSecret(
  db: DB,
  scope: EmployeeAccountScope,
  employeeId: number,
  now = new Date(),
) {
  const [row] = await db.select({
    secretId: employeeActivationSecret.id,
    userId: employeeActivationSecret.userId,
    purpose: employeeActivationSecret.purpose,
    generation: employeeActivationSecret.generation,
    credentialEnvelope: employeeActivationSecret.credentialEnvelope,
    expiresAt: employeeActivationSecret.expiresAt,
    passwordChangeRequired: appUser.passwordChangeRequired,
    accountState: appUser.accountState,
  }).from(employeeActivationSecret)
    .innerJoin(employee, eq(employee.id, employeeActivationSecret.employeeId))
    .innerJoin(appUser, eq(appUser.userId, employeeActivationSecret.userId))
    .where(and(
      eq(employeeActivationSecret.masterFn, scope.masterFn),
      eq(employeeActivationSecret.companyFn, scope.companyFn),
      eq(employeeActivationSecret.employeeId, employeeId),
      isNull(employeeActivationSecret.clearedAt),
      eq(employee.userId, employeeActivationSecret.userId),
    )).limit(1);
  if (!row || !row.passwordChangeRequired || !row.credentialEnvelope) {
    throw new EmployeeAccountError('temporary_credential_unavailable', 'No recoverable temporary credential exists.', 404);
  }
  if (row.expiresAt <= now) {
    throw new EmployeeAccountError('temporary_credential_expired', 'The temporary credential has expired. Reset it.', 410);
  }
  return row;
}

export interface ResetEmployeeAccountInput {
  employeeId: number;
  passwordHash: string;
  credentialEnvelope: EncryptedToken;
  expiresAt: Date;
  actorUserId: number;
  requestId?: string;
}

export async function resetEmployeeAccount(
  db: DB,
  scope: EmployeeAccountScope,
  input: ResetEmployeeAccountInput,
) {
  return db.transaction(async (tx) => {
    const account = await readEmployeeAccount(tx as DB, scope, input.employeeId);
    if (!account.userId || account.accountState === 'offboarded' || !account.employeeActive) {
      throw new EmployeeAccountError('employee_account_unavailable', 'This employee account cannot be reset.', 409);
    }
    const allSecrets = await tx.select({
      id: employeeActivationSecret.id,
      generation: employeeActivationSecret.generation,
      clearedAt: employeeActivationSecret.clearedAt,
    }).from(employeeActivationSecret).where(and(
      eq(employeeActivationSecret.masterFn, scope.masterFn),
      eq(employeeActivationSecret.companyFn, scope.companyFn),
      eq(employeeActivationSecret.userId, account.userId),
    ));
    const current = allSecrets.filter((row) => row.clearedAt == null);
    const now = new Date();
    if (current.length) {
      await tx.update(employeeActivationSecret).set({
        credentialEnvelope: null,
        clearedAt: now,
        updatedAt: now,
      }).where(inArray(employeeActivationSecret.id, current.map((row) => row.id)));
    }
    const generation = Math.max(0, ...allSecrets.map((row) => row.generation)) + 1;
    await tx.update(appUser).set({
      passwordHash: input.passwordHash,
      passwordChangeRequired: true,
      initialPasswordExpiresAt: input.expiresAt,
      accountState: account.accountState === 'preactivated' ? 'preactivated' : 'active',
      updatedAt: now,
    }).where(eq(appUser.userId, account.userId));
    await tx.update(appSession).set({ revokedAt: now, updatedAt: now }).where(and(
      eq(appSession.userId, account.userId),
      isNull(appSession.revokedAt),
    ));
    await tx.insert(employeeActivationSecret).values({
      ...scope,
      employeeId: input.employeeId,
      userId: account.userId,
      purpose: 'reset',
      generation,
      credentialEnvelope: input.credentialEnvelope,
      expiresAt: input.expiresAt,
      createdByUserId: input.actorUserId,
    });
    if (input.requestId) {
      await tx.insert(auditLog).values({
        ...scope,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        entity: 'employee_account',
        entityId: String(input.employeeId),
        action: 'temporary_password_reset',
        after: { userId: account.userId, generation },
      });
    }
    return { employeeId: input.employeeId, userId: account.userId, generation };
  });
}

export async function completeEmployeeActivation(
  db: DB,
  userId: number,
  email: string,
  passwordHash: string,
  requestId?: string,
) {
  return db.transaction(async (tx) => {
    const [user] = await tx.select({
      userId: appUser.userId,
      masterFn: appUser.masterFn,
      passwordChangeRequired: appUser.passwordChangeRequired,
      accountState: appUser.accountState,
    }).from(appUser).where(and(eq(appUser.userId, userId), eq(appUser.isActive, true))).limit(1);
    if (!user || !user.passwordChangeRequired || user.accountState === 'offboarded') {
      throw new EmployeeAccountError('activation_not_required', 'This account does not require activation.', 409);
    }
    const [linked] = await tx.select({ employeeId: employee.id }).from(employee).where(and(
      eq(employee.masterFn, user.masterFn),
      eq(employee.userId, userId),
      eq(employee.isActive, true),
    )).limit(1);
    if (!linked) throw new EmployeeAccountError('employee_link_missing', 'The employee link is unavailable.', 409);
    const [duplicateEmail] = await tx.select({ userId: appUser.userId }).from(appUser).where(and(
      eq(appUser.masterFn, user.masterFn),
      eq(appUser.email, email),
      ne(appUser.userId, userId),
    )).limit(1);
    if (duplicateEmail) {
      throw new EmployeeAccountError('email_taken', 'Email is already used in this organization.', 409, {
        email: 'Use another email address.',
      });
    }
    const now = new Date();
    await tx.update(appUser).set({
      email,
      passwordHash,
      passwordChangeRequired: false,
      initialPasswordExpiresAt: null,
      accountState: 'active',
      activatedAt: now,
      updatedAt: now,
    }).where(eq(appUser.userId, userId));
    await tx.update(employeeActivationSecret).set({
      credentialEnvelope: null,
      clearedAt: now,
      updatedAt: now,
    }).where(and(
      eq(employeeActivationSecret.userId, userId),
      isNull(employeeActivationSecret.clearedAt),
    ));
    await tx.update(appSession).set({ revokedAt: now, updatedAt: now }).where(and(
      eq(appSession.userId, userId),
      isNull(appSession.revokedAt),
    ));
    if (requestId) {
      await tx.insert(auditLog).values({
        masterFn: user.masterFn,
        actorUserId: userId,
        requestId,
        entity: 'app_user',
        entityId: String(userId),
        action: 'employee_activation_completed',
        after: { employeeId: linked.employeeId, activatedAt: now },
      });
    }
    return { userId, employeeId: linked.employeeId, activatedAt: now };
  });
}

export interface OffboardEmployeeInput {
  employeeId: number;
  targetEmployeeId: number;
  reason: string;
  actorUserId: number;
  requestId?: string;
}

export async function offboardEmployeeAccount(
  db: DB,
  scope: EmployeeAccountScope,
  input: OffboardEmployeeInput,
) {
  return db.transaction(async (tx) => {
    const rows = await tx.select({
      id: employee.id,
      userId: employee.userId,
      isActive: employee.isActive,
      managerId: employee.managerId,
    }).from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      inArray(employee.id, [input.employeeId, input.targetEmployeeId]),
    ));
    const source = rows.find((row) => row.id === input.employeeId);
    const target = rows.find((row) => row.id === input.targetEmployeeId);
    if (!source?.userId) throw new EmployeeAccountError('employee_account_missing', 'Source employee has no account.', 409);
    if (!source.isActive) throw new EmployeeAccountError('employee_already_inactive', 'Employee is already inactive.', 409);
    if (!target?.userId || !target.isActive || target.id === source.id) {
      throw new EmployeeAccountError('invalid_handoff_target', 'Choose another active employee with an account.', 400, {
        targetEmployeeId: 'A valid handoff target is required.',
      });
    }
    const [targetUser] = await tx.select({ active: appUser.isActive }).from(appUser).where(and(
      eq(appUser.userId, target.userId),
      eq(appUser.masterFn, scope.masterFn),
    )).limit(1);
    if (!targetUser?.active) {
      throw new EmployeeAccountError('invalid_handoff_target', 'The handoff target account is inactive.', 409);
    }
    const now = new Date();
    const directReports = await tx.update(employee).set({
      managerId: target.id,
      updatedAt: now,
    }).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.managerId, source.id),
      ne(employee.id, target.id),
    )).returning({ id: employee.id });
    const customers = await tx.update(customer).set({
      ownerUserId: target.userId,
      updatedAt: now,
    }).where(and(
      eq(customer.masterFn, scope.masterFn),
      eq(customer.companyFn, scope.companyFn),
      eq(customer.ownerUserId, source.userId),
    )).returning({ id: customer.id });
    const opportunities = await tx.update(opportunity).set({
      ownerUserId: target.userId,
      updatedAt: now,
    }).where(and(
      eq(opportunity.masterFn, scope.masterFn),
      eq(opportunity.companyFn, scope.companyFn),
      eq(opportunity.ownerUserId, source.userId),
      notInArray(opportunity.stage, ['won', 'lost']),
    )).returning({ id: opportunity.id });
    const notifications = await tx.update(appNotification).set({
      recipientUserId: target.userId,
      updatedAt: now,
    }).where(and(
      eq(appNotification.masterFn, scope.masterFn),
      eq(appNotification.companyFn, scope.companyFn),
      eq(appNotification.recipientUserId, source.userId),
      isNull(appNotification.readAt),
      isNull(appNotification.dismissedAt),
    )).returning({ id: appNotification.id });
    await tx.update(employee).set({ isActive: false, updatedAt: now }).where(eq(employee.id, source.id));
    await syncManagerRolesWithin(tx, scope, [
      source.id,
      source.managerId,
      target.id,
    ]);
    await tx.update(appUser).set({
      isActive: false,
      accountState: 'offboarded',
      passwordChangeRequired: false,
      initialPasswordExpiresAt: null,
      offboardedAt: now,
      updatedAt: now,
    }).where(eq(appUser.userId, source.userId));
    await tx.update(appSession).set({ revokedAt: now, updatedAt: now }).where(and(
      eq(appSession.userId, source.userId),
      isNull(appSession.revokedAt),
    ));
    await tx.update(employeeActivationSecret).set({
      credentialEnvelope: null,
      clearedAt: now,
      updatedAt: now,
    }).where(and(
      eq(employeeActivationSecret.userId, source.userId),
      isNull(employeeActivationSecret.clearedAt),
    ));
    const counts = {
      directReportsTransferred: directReports.length,
      customersTransferred: customers.length,
      opportunitiesTransferred: opportunities.length,
      notificationsTransferred: notifications.length,
    };
    const [handoff] = await tx.insert(employeeAccountHandoff).values({
      ...scope,
      sourceEmployeeId: source.id,
      sourceUserId: source.userId,
      targetEmployeeId: target.id,
      targetUserId: target.userId,
      reason: input.reason,
      ...counts,
      performedByUserId: input.actorUserId,
      occurredAt: now,
    }).returning({ id: employeeAccountHandoff.id });
    if (input.requestId) {
      await tx.insert(auditLog).values({
        ...scope,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        entity: 'employee_account',
        entityId: String(source.id),
        action: 'offboarded',
        after: { targetEmployeeId: target.id, reason: input.reason, handoffId: handoff.id, ...counts },
      });
    }
    return { handoffId: handoff.id, ...counts };
  });
}
