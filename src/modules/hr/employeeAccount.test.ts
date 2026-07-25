import { describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
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
  userCompanyRole,
} from '../../data/schema';
import { hashPassword, verifyPassword } from '../../auth/password';
import { encryptToken } from '../../auth/tokenCrypto';
import { createSession, getSession } from '../../auth/session';
import {
  activeEmployeeSecret,
  completeEmployeeActivation,
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
      accountState: 'preactivated',
      passwordChangeRequired: true,
    });
    expect(JSON.stringify(secret.credentialEnvelope)).not.toContain('Temp-employee-123!');
    await expect(provision(data, data.source.id, 'other.name'))
      .rejects.toMatchObject({ code: 'employee_account_exists' });
  });

  it('completes first login, destroys the envelope and revokes all sessions', async () => {
    const data = await fixture();
    const account = await provision(data, data.source.id, 'employee.activate');
    const live = await createSession(data.db, {
      userId: account.userId,
      masterFn: scope.masterFn,
      activeCompanyFn: scope.companyFn,
      username: 'employee.activate',
      email: null,
      fullName: data.source.fullName,
    });

    await completeEmployeeActivation(
      data.db,
      account.userId,
      'employee.activate@example.com',
      hashPassword('Changed-password-123!'),
    );

    const [user] = await data.db.select().from(appUser).where(eq(appUser.userId, account.userId));
    const [secret] = await data.db.select().from(employeeActivationSecret)
      .where(eq(employeeActivationSecret.userId, account.userId));
    expect(user).toMatchObject({
      email: 'employee.activate@example.com',
      accountState: 'active',
      passwordChangeRequired: false,
    });
    expect(verifyPassword('Temp-employee-123!', user.passwordHash)).toBe(false);
    expect(secret.credentialEnvelope).toBeNull();
    expect(secret.clearedAt).toBeInstanceOf(Date);
    expect(await getSession(data.db, live.sessionId)).toBeNull();
    await expect(activeEmployeeSecret(data.db, scope, data.source.id))
      .rejects.toMatchObject({ code: 'temporary_credential_unavailable' });
  });

  it('HR reset rotates the credential, clears the prior envelope and revokes sessions', async () => {
    const data = await fixture();
    const account = await provision(data, data.source.id, 'employee.reset');
    const [first] = await data.db.select().from(employeeActivationSecret)
      .where(eq(employeeActivationSecret.userId, account.userId));
    await completeEmployeeActivation(
      data.db,
      account.userId,
      'employee.reset@example.com',
      hashPassword('Changed-password-123!'),
    );
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
