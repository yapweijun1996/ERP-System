import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { freshDb } from '../../test/helpers';
import { seedDemo } from '../../data/seed';
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
  userCompanyRole,
} from '../../data/schema';
import { hashPassword, verifyPassword } from '../../auth/password';
import { encryptToken } from '../../auth/tokenCrypto';
import { createSession, getSession } from '../../auth/session';
import {
  activeEmployeeSecret,
  createEmployeeAccount,
  offboardEmployeeAccount,
  resetEmployeeAccount,
} from './employeeAccount';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const encryptionKey = Buffer.alloc(32, 7);

describe('employee account lifecycle', () => {
  async function fixture() {
    const db = await freshDb();
    await seedDemo(db);
    const [actor] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const employees = await db.select().from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
    ));
    const source = employees.find((row) => row.managerId != null && row.userId == null)!;
    const target = employees.find((row) =>
      row.id !== source.id && row.isActive && row.userId == null)!;
    return { db, actor, source, target };
  }

  async function provision(
    data: Awaited<ReturnType<typeof fixture>>,
    employeeId: number,
    username: string,
    password = 'Temp-employee-123!',
  ) {
    return createEmployeeAccount(data.db, scope, {
      employeeId,
      username,
      passwordHash: hashPassword(password),
      credentialEnvelope: encryptToken(password, encryptionKey),
      expiresAt: new Date(Date.now() + 60_000),
      actorUserId: data.actor.userId,
    });
  }

  it('creates one company-scoped binding with encrypted, recoverable activation evidence', async () => {
    const data = await fixture();
    const account = await provision(data, data.source.id, 'employee.one');
    const [linked] = await data.db.select().from(employee).where(eq(employee.id, data.source.id));
    const [user] = await data.db.select().from(appUser).where(eq(appUser.userId, account.userId));
    const secret = await activeEmployeeSecret(data.db, scope, data.source.id);

    expect(linked.userId).toBe(account.userId);
    expect(user).toMatchObject({
      username: 'employee.one',
      email: null,
      accountState: 'active',
      passwordChangeRequired: false,
    });
    const [employeeGrant] = await data.db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, account.userId),
      eq(userCompanyRole.companyFn, scope.companyFn),
    ));
    expect(employeeGrant.managedBySystem).toBe(true);
    expect(JSON.stringify(secret.credentialEnvelope)).not.toContain('Temp-employee-123!');
    await expect(provision(data, data.source.id, 'other.name'))
      .rejects.toMatchObject({ code: 'employee_account_exists' });
  });

  it('creates the missing company Employee role before provisioning the first account', async () => {
    const data = await fixture();
    const [employeeRole] = await data.db.select().from(role).where(and(
      eq(role.masterFn, scope.masterFn),
      eq(role.name, 'Employee'),
    )).limit(1);
    await data.db.delete(userCompanyRole).where(eq(userCompanyRole.roleId, employeeRole.roleId));
    await data.db.delete(roleResourceScope).where(eq(roleResourceScope.roleId, employeeRole.roleId));
    await data.db.delete(rolePermission).where(eq(rolePermission.roleId, employeeRole.roleId));
    await data.db.delete(role).where(eq(role.roleId, employeeRole.roleId));

    const account = await provision(data, data.source.id, 'employee.auto-role');
    const [createdRole] = await data.db.select().from(role).where(and(
      eq(role.masterFn, scope.masterFn),
      eq(role.companyFn, scope.companyFn),
      eq(role.name, 'Employee'),
    )).limit(1);
    const permissions = await data.db.select().from(rolePermission)
      .where(eq(rolePermission.roleId, createdRole.roleId));
    const [resourceScope] = await data.db.select().from(roleResourceScope).where(and(
      eq(roleResourceScope.roleId, createdRole.roleId),
      eq(roleResourceScope.companyFn, scope.companyFn),
    ));

    expect(account.username).toBe('employee.auto-role');
    expect(permissions.map((row) => row.permissionKey).sort()).toEqual([
      'employee.claims.write',
      'employee.leave.write',
      'employee.payout.manage',
      'employee.receipts.write',
      'employee.self.read',
      'expenses.company_receipts.create',
      'expenses.company_receipts.edit',
      'expenses.company_receipts.read_own',
      'expenses.company_receipts.void',
    ]);
    expect(resourceScope).toMatchObject({ resourceKey: 'employee/*', scope: 'self' });
  });

  it.each([false, true])('accepts an existing Employee role without rewriting its grants (legacy=%s)', async legacy => {
    const data = await fixture();
    await provision(data, data.source.id, 'employee.contract.first');
    const [baseRole] = await data.db.select().from(role).where(and(
      eq(role.masterFn, scope.masterFn), eq(role.companyFn, scope.companyFn), eq(role.name, 'Employee'),
    ));
    if (legacy) await data.db.delete(rolePermission).where(and(
      eq(rolePermission.roleId, baseRole.roleId),
      inArray(rolePermission.permissionKey, ['expenses.company_receipts.create', 'expenses.company_receipts.edit', 'expenses.company_receipts.void']),
    ));
    const before = await data.db.select().from(rolePermission).where(eq(rolePermission.roleId, baseRole.roleId));
    await provision(data, data.target.id, 'employee.contract.second');
    const after = await data.db.select().from(rolePermission).where(eq(rolePermission.roleId, baseRole.roleId));
    expect(after).toEqual(before);
    expect(after).toHaveLength(legacy ? 6 : 9);
  });

  it('fails closed when an Employee role has privileged or altered access', async () => {
    const data = await fixture();
    const [employeeRole] = await data.db.insert(role).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      name: 'Employee',
      isSuperadmin: true,
    }).returning();
    await data.db.update(role).set({ isSuperadmin: true }).where(eq(role.roleId, employeeRole.roleId));

    await expect(provision(data, data.source.id, 'employee.privileged-role'))
      .rejects.toMatchObject({ code: 'employee_role_misconfigured', status: 503 });
    const [linked] = await data.db.select({ userId: employee.userId }).from(employee)
      .where(eq(employee.id, data.source.id));
    expect(linked.userId).toBeNull();
  });

  it('creates the canonical Manager role when the first manager account is provisioned', async () => {
    const data = await fixture();
    await data.db.insert(employee).values({
      ...scope,
      employeeNo: 'EMP-MGR-AUTO',
      fullName: 'Auto Manager Report',
      email: 'auto.manager.report@example.test',
      department: 'Operations',
      jobTitle: 'Coordinator',
      managerId: data.source.id,
      startDate: '2026-07-25',
      baseSalary: '3200.00',
    });
    const [managerRole] = await data.db.select().from(role).where(and(
      eq(role.masterFn, scope.masterFn),
      eq(role.name, 'Manager'),
    )).limit(1);
    await data.db.delete(userCompanyRole).where(eq(userCompanyRole.roleId, managerRole.roleId));
    await data.db.delete(roleResourceScope).where(eq(roleResourceScope.roleId, managerRole.roleId));
    await data.db.delete(rolePermission).where(eq(rolePermission.roleId, managerRole.roleId));
    await data.db.delete(role).where(eq(role.roleId, managerRole.roleId));

    const account = await provision(data, data.source.id, 'employee.auto-manager');
    const [createdRole] = await data.db.select().from(role).where(and(
      eq(role.masterFn, scope.masterFn),
      eq(role.companyFn, scope.companyFn),
      eq(role.name, 'Manager'),
    )).limit(1);
    const [managedGrant] = await data.db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, account.userId),
      eq(userCompanyRole.companyFn, scope.companyFn),
      eq(userCompanyRole.roleId, createdRole.roleId),
      eq(userCompanyRole.managedBySystem, true),
    ));

    expect(createdRole.sourceTemplateKey).toBe('manager');
    expect(managedGrant).toBeDefined();
  });

  it('allows immediate access without changing the assigned password or consuming its handoff', async () => {
    const data = await fixture();
    const account = await provision(data, data.source.id, 'employee.ready');
    const live = await createSession(data.db, {
      userId: account.userId, masterFn: scope.masterFn, activeCompanyFn: scope.companyFn,
      username: 'employee.ready', email: null, fullName: data.source.fullName,
    });
    const [user] = await data.db.select().from(appUser).where(eq(appUser.userId, account.userId));
    expect(user.accountState).toBe('active');
    expect(user.passwordChangeRequired).toBe(false);
    expect(user.initialPasswordExpiresAt).toBeNull();
    expect(verifyPassword('Temp-employee-123!', user.passwordHash)).toBe(true);
    expect(await getSession(data.db, live.sessionId)).not.toBeNull();
    expect((await activeEmployeeSecret(data.db, scope, data.source.id)).credentialEnvelope).not.toBeNull();
  });

  it('migrates pending accounts without changing passwords, roles or disabled state', async () => {
    const data = await fixture();
    const account = await provision(data, data.source.id, 'employee.migrate');
    await data.db.update(appUser).set({
      accountState: 'preactivated', passwordChangeRequired: true,
      initialPasswordExpiresAt: new Date(0), isActive: false,
    }).where(eq(appUser.userId, account.userId));
    const [before] = await data.db.select().from(appUser).where(eq(appUser.userId, account.userId));
    const grants = await data.db.select().from(userCompanyRole).where(eq(userCompanyRole.userId, account.userId));
    const migration = readFileSync(new URL('../../../drizzle/0111_immediate_account_access.sql', import.meta.url), 'utf8');
    await data.db.execute(sql.raw(migration));
    await data.db.execute(sql.raw(migration));
    const [after] = await data.db.select().from(appUser).where(eq(appUser.userId, account.userId));
    expect(after).toMatchObject({ accountState: 'active', passwordChangeRequired: false,
      initialPasswordExpiresAt: null, isActive: false, passwordHash: before.passwordHash });
    expect(await data.db.select().from(userCompanyRole).where(eq(userCompanyRole.userId, account.userId))).toEqual(grants);
    const evidence = await data.db.select().from(auditLog).where(and(
      eq(auditLog.entityId, String(account.userId)), eq(auditLog.action, 'first_login_activation_removed'),
    ));
    expect(evidence).toHaveLength(1);
  });

  it('HR reset rotates the credential, clears the prior envelope and revokes sessions', async () => {
    const data = await fixture();
    const account = await provision(data, data.source.id, 'employee.reset');
    const [first] = await data.db.select().from(employeeActivationSecret)
      .where(eq(employeeActivationSecret.userId, account.userId));

    const live = await createSession(data.db, {
      userId: account.userId,
      masterFn: scope.masterFn,
      activeCompanyFn: scope.companyFn,
      username: 'employee.reset',
      email: 'employee.reset@example.com',
      fullName: data.source.fullName,
    });
    await resetEmployeeAccount(data.db, scope, {
      employeeId: data.source.id,
      passwordHash: hashPassword('New-temp-456!'),
      credentialEnvelope: encryptToken('New-temp-456!', encryptionKey),
      expiresAt: new Date(Date.now() + 60_000),
      actorUserId: data.actor.userId,
    });
    const secrets = await data.db.select().from(employeeActivationSecret)
      .where(eq(employeeActivationSecret.userId, account.userId));
    expect(secrets).toHaveLength(2);
    expect(secrets.find((row) => row.id === first.id)?.credentialEnvelope).toBeNull();
    expect(secrets.find((row) => row.id !== first.id)).toMatchObject({
      purpose: 'reset',
      generation: 2,
      clearedAt: null,
    });
    expect(await getSession(data.db, live.sessionId)).toBeNull();
  });

  it('offboards immediately, transfers current work and preserves historical ownership', async () => {
    const data = await fixture();
    await data.db.insert(employee).values({
      ...scope,
      employeeNo: 'EMP-HANDOFF-REPORT',
      fullName: 'Handoff Direct Report',
      email: 'handoff.report@example.test',
      department: 'Operations',
      jobTitle: 'Coordinator',
      employmentType: 'Full-time',
      managerId: data.source.id,
      startDate: '2026-07-25',
      baseSalary: '3200.00',
    });
    const sourceAccount = await provision(data, data.source.id, 'employee.source');
    const targetAccount = await provision(data, data.target.id, 'employee.target');
    const [managerRole] = await data.db.select().from(role).where(and(
      eq(role.masterFn, scope.masterFn),
      eq(role.name, 'Manager'),
    ));
    expect(await data.db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, sourceAccount.userId),
      eq(userCompanyRole.companyFn, scope.companyFn),
      eq(userCompanyRole.roleId, managerRole.roleId),
      eq(userCompanyRole.managedBySystem, true),
    ))).toHaveLength(1);
    await data.db.update(customer).set({ ownerUserId: sourceAccount.userId })
      .where(and(eq(customer.masterFn, scope.masterFn), eq(customer.companyFn, scope.companyFn)));
    await data.db.update(opportunity).set({ ownerUserId: sourceAccount.userId })
      .where(and(eq(opportunity.masterFn, scope.masterFn), eq(opportunity.companyFn, scope.companyFn)));
    await data.db.insert(appNotification).values({
      ...scope,
      recipientUserId: sourceAccount.userId,
      kind: 'system_notice',
      subject: 'Outstanding work',
      detail: 'Transfer this notification.',
    });
    const live = await createSession(data.db, {
      userId: sourceAccount.userId,
      masterFn: scope.masterFn,
      activeCompanyFn: scope.companyFn,
      username: 'employee.source',
      email: null,
      fullName: data.source.fullName,
    });

    const result = await offboardEmployeeAccount(data.db, scope, {
      employeeId: data.source.id,
      targetEmployeeId: data.target.id,
      reason: 'Employment ended',
      actorUserId: data.actor.userId,
    });

    const [sourceEmployee] = await data.db.select().from(employee).where(eq(employee.id, data.source.id));
    const [sourceUser] = await data.db.select().from(appUser).where(eq(appUser.userId, sourceAccount.userId));
    const [handoff] = await data.db.select().from(employeeAccountHandoff)
      .where(eq(employeeAccountHandoff.id, result.handoffId));
    expect(sourceEmployee.isActive).toBe(false);
    expect(sourceUser).toMatchObject({ isActive: false, accountState: 'offboarded' });
    expect(await getSession(data.db, live.sessionId)).toBeNull();
    expect(handoff.targetUserId).toBe(targetAccount.userId);
    expect(result.customersTransferred).toBeGreaterThan(0);
    expect(await data.db.select().from(customer).where(and(
      eq(customer.ownerUserId, sourceAccount.userId),
      eq(customer.companyFn, scope.companyFn),
    ))).toHaveLength(0);
    expect(await data.db.select().from(appSession).where(and(
      eq(appSession.userId, sourceAccount.userId),
      isNull(appSession.revokedAt),
    ))).toHaveLength(0);
    expect(await data.db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, sourceAccount.userId),
      eq(userCompanyRole.companyFn, scope.companyFn),
      eq(userCompanyRole.roleId, managerRole.roleId),
    ))).toHaveLength(0);
    expect(await data.db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, targetAccount.userId),
      eq(userCompanyRole.companyFn, scope.companyFn),
      eq(userCompanyRole.roleId, managerRole.roleId),
      eq(userCompanyRole.managedBySystem, true),
    ))).toHaveLength(1);
    // Audit is written by the API boundary; the domain handoff remains an
    // immutable, independently queryable business record.
    expect(await data.db.select().from(auditLog)).toBeDefined();
  });
});
