import { and, asc, eq, isNull, ne, or } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import {
  accountingPeriod,
  appUser,
  company,
  companyPolicy,
  currency,
  documentSequence,
  master,
  role,
  taxRule,
  userCompany,
  userCompanyRole,
} from '../../data/schema';
import { appendAudit } from '../../api/audit';
import { ensureEmployeeNumberSequenceWithin } from '../hr/employee';

export interface ControlScope { masterFn: string; companyFn: string }
export interface ControlActor { userId: number; requestId: string }

export class ControlPlaneError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export async function getMasterControlWithin(exec: DB, scope: ControlScope) {
  const [tenant] = await exec.select({ masterFn: master.masterFn, name: master.name })
    .from(master).where(eq(master.masterFn, scope.masterFn)).limit(1);
  if (!tenant) throw new ControlPlaneError('tenant_not_found', 'Tenant not found.');
  const companies = await exec.select({
    companyFn: company.companyFn,
    name: company.name,
    country: company.country,
    currency: company.currency,
    taxRegime: company.taxRegime,
    locale: company.locale,
    fiscalYearStart: company.fiscalYearStart,
  }).from(company).where(eq(company.masterFn, scope.masterFn)).orderBy(company.companyFn);
  const assignments = await exec.select({
    companyFn: userCompany.companyFn,
    userId: userCompany.userId,
  }).from(userCompany)
    .innerJoin(appUser, eq(appUser.userId, userCompany.userId))
    .where(and(eq(appUser.masterFn, scope.masterFn), eq(appUser.identityKind, 'human')));
  const users = await exec.select({
    userId: appUser.userId,
    username: appUser.username,
    email: appUser.email,
    fullName: appUser.fullName,
    isActive: appUser.isActive,
    companyFn: userCompany.companyFn,
  }).from(userCompany)
    .innerJoin(appUser, eq(appUser.userId, userCompany.userId))
    .where(and(
      eq(appUser.masterFn, scope.masterFn),
      eq(appUser.identityKind, 'human'),
      eq(userCompany.companyFn, scope.companyFn),
    ))
    .orderBy(appUser.userId);
  const userRoleRows = await exec.select({
    userId: userCompanyRole.userId,
    roleId: role.roleId,
    roleName: role.name,
  }).from(userCompanyRole)
    .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
    .where(and(
      eq(userCompanyRole.companyFn, scope.companyFn),
      eq(role.masterFn, scope.masterFn),
      or(isNull(role.sourceTemplateKey), ne(role.sourceTemplateKey, 'platform_tenant_admin')),
    ))
    .orderBy(userCompanyRole.userId, role.roleId);
  const rolesByUser = new Map<number, Array<{ roleId: number; roleName: string }>>();
  for (const row of userRoleRows) {
    const grants = rolesByUser.get(row.userId) ?? [];
    grants.push({ roleId: row.roleId, roleName: row.roleName });
    rolesByUser.set(row.userId, grants);
  }
  const roles = await exec.select({ roleId: role.roleId, name: role.name, isSuperadmin: role.isSuperadmin })
    .from(role).where(and(
      eq(role.masterFn, scope.masterFn),
      or(isNull(role.sourceTemplateKey), ne(role.sourceTemplateKey, 'platform_tenant_admin')),
    )).orderBy(role.roleId);
  const counts = new Map<string, Set<number>>();
  assignments.forEach((a) => {
    const set = counts.get(a.companyFn) ?? new Set<number>();
    set.add(a.userId);
    counts.set(a.companyFn, set);
  });
  return {
    master: tenant,
    activeCompanyFn: scope.companyFn,
    companies: companies.map((row) => ({ ...row, userCount: counts.get(row.companyFn)?.size ?? 0 })),
    users: users.map((user) => {
      const grants = rolesByUser.get(user.userId) ?? [];
      return {
        ...user,
        roleId: grants[0]?.roleId ?? null,
        roleName: grants.map((grant) => grant.roleName).join(', '),
        roles: grants,
      };
    }),
    roles,
  };
}

export async function getSystemSettingsWithin(exec: DB, scope: ControlScope) {
  const [companyRow] = await exec.select({
    companyFn: company.companyFn,
    name: company.name,
    country: company.country,
    currency: company.currency,
    taxRegime: company.taxRegime,
    locale: company.locale,
    fiscalYearStart: company.fiscalYearStart,
  }).from(company).where(and(
    eq(company.masterFn, scope.masterFn), eq(company.companyFn, scope.companyFn),
  )).limit(1);
  if (!companyRow) throw new ControlPlaneError('company_not_found', 'Active company not found.');
  // Existing production companies may predate the employee sequence row. The
  // default is initialized lazily from the already-governed document_sequence
  // table, so no schema migration or employee data rewrite is required.
  await ensureEmployeeNumberSequenceWithin(exec, scope);
  const [policy] = await exec.select().from(companyPolicy).where(and(
    eq(companyPolicy.masterFn, scope.masterFn), eq(companyPolicy.companyFn, scope.companyFn),
  )).limit(1);
  const sequences = await exec.select().from(documentSequence).where(and(
    eq(documentSequence.masterFn, scope.masterFn), eq(documentSequence.companyFn, scope.companyFn),
  )).orderBy(documentSequence.id);
  const periods = await exec.select().from(accountingPeriod).where(and(
    eq(accountingPeriod.masterFn, scope.masterFn), eq(accountingPeriod.companyFn, scope.companyFn),
  )).orderBy(asc(accountingPeriod.startDate), accountingPeriod.id);
  const taxes = await exec.select({
    id: taxRule.id,
    taxRegime: taxRule.taxRegime,
    taxCode: taxRule.taxCode,
    rate: taxRule.rate,
    validFrom: taxRule.validFrom,
    validTo: taxRule.validTo,
  }).from(taxRule).where(and(
    eq(taxRule.masterFn, scope.masterFn), eq(taxRule.companyFn, scope.companyFn),
  )).orderBy(taxRule.taxCode, taxRule.validFrom);
  const currencies = await exec.select().from(currency).orderBy(currency.code);
  const withoutTenant = <T extends { masterFn: string; companyFn: string }>(row: T) => {
    const { masterFn: _masterFn, companyFn: _companyFn, ...safe } = row;
    void _masterFn; void _companyFn;
    return safe;
  };
  return {
    company: companyRow,
    policy: policy ? withoutTenant(policy) : null,
    sequences: sequences.map(withoutTenant),
    periods: periods.map(withoutTenant),
    taxes,
    currencies,
  };
}

export interface UpdateCompanyPolicyInput {
  dateFormat: string;
  negativeStockPolicy: string;
  approvalThreshold: string;
  sessionTimeoutMinutes: number;
  defaultWarehouseCode?: string | null;
}

export async function updateCompanyPolicyWithin(
  exec: DB, scope: ControlScope, actor: ControlActor, input: UpdateCompanyPolicyInput,
) {
  if (!['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'].includes(input.dateFormat)) {
    throw new ControlPlaneError('invalid_date_format', 'Unsupported date format.');
  }
  if (!['block', 'warn'].includes(input.negativeStockPolicy)) {
    throw new ControlPlaneError('invalid_stock_policy', 'Negative stock policy must be block or warn.');
  }
  const threshold = new Decimal(input.approvalThreshold || '0');
  if (!threshold.isFinite() || threshold.isNegative() || threshold.decimalPlaces() > 2) {
    throw new ControlPlaneError('invalid_threshold', 'Approval threshold must be a non-negative amount with at most 2 decimals.');
  }
  if (!Number.isInteger(input.sessionTimeoutMinutes) || input.sessionTimeoutMinutes < 15 || input.sessionTimeoutMinutes > 1440) {
    throw new ControlPlaneError('invalid_timeout', 'Session timeout must be between 15 and 1440 minutes.');
  }
  const [existing] = await exec.select().from(companyPolicy).where(and(
    eq(companyPolicy.masterFn, scope.masterFn), eq(companyPolicy.companyFn, scope.companyFn),
  )).limit(1);
  const values = {
    dateFormat: input.dateFormat,
    negativeStockPolicy: input.negativeStockPolicy,
    approvalThreshold: threshold.toFixed(2),
    sessionTimeoutMinutes: input.sessionTimeoutMinutes,
    defaultWarehouseCode: input.defaultWarehouseCode?.trim() || null,
    version: (existing?.version ?? 0) + 1,
    updatedAt: new Date(),
  };
  const [saved] = existing
    ? await exec.update(companyPolicy).set(values).where(eq(companyPolicy.id, existing.id)).returning()
    : await exec.insert(companyPolicy).values({ ...scope, ...values }).returning();
  await appendAudit(exec, {
    ...scope, actorUserId: actor.userId, requestId: actor.requestId,
    entity: 'company_policy', entityId: saved.id, action: 'update',
    before: existing ?? null, after: saved,
  });
  return saved;
}

export interface UpdateSequenceInput {
  prefix: string;
  nextNumber: number;
  padding: number;
  resetPolicy: string;
}

export async function updateDocumentSequenceWithin(
  exec: DB, scope: ControlScope, actor: ControlActor, id: number, input: UpdateSequenceInput,
) {
  const [existing] = await exec.select().from(documentSequence).where(and(
    eq(documentSequence.id, id), eq(documentSequence.masterFn, scope.masterFn),
    eq(documentSequence.companyFn, scope.companyFn),
  )).limit(1);
  if (!existing) throw new ControlPlaneError('sequence_not_found', 'Document sequence not found.');
  const prefix = input.prefix.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,12}$/.test(prefix)) throw new ControlPlaneError('invalid_prefix', 'Prefix must contain 1–12 letters, numbers or hyphens.');
  if (!Number.isInteger(input.nextNumber) || input.nextNumber < 1) throw new ControlPlaneError('invalid_next_number', 'Next number must be a positive integer.');
  if (!Number.isInteger(input.padding) || input.padding < 2 || input.padding > 10) throw new ControlPlaneError('invalid_padding', 'Padding must be between 2 and 10.');
  if (!['never', 'yearly', 'monthly'].includes(input.resetPolicy)) throw new ControlPlaneError('invalid_reset_policy', 'Unsupported reset policy.');
  const [saved] = await exec.update(documentSequence).set({
    prefix, nextNumber: input.nextNumber, padding: input.padding,
    resetPolicy: input.resetPolicy, version: existing.version + 1, updatedAt: new Date(),
  }).where(eq(documentSequence.id, existing.id)).returning();
  await appendAudit(exec, {
    ...scope, actorUserId: actor.userId, requestId: actor.requestId,
    entity: 'document_sequence', entityId: id, action: 'update', before: existing, after: saved,
  });
  return saved;
}

export async function setAccountingPeriodStatusWithin(
  exec: DB, scope: ControlScope, actor: ControlActor, id: number, status: string,
) {
  if (!['open', 'locked'].includes(status)) throw new ControlPlaneError('invalid_period_status', 'Period status must be open or locked.');
  const [existing] = await exec.select().from(accountingPeriod).where(and(
    eq(accountingPeriod.id, id), eq(accountingPeriod.masterFn, scope.masterFn),
    eq(accountingPeriod.companyFn, scope.companyFn),
  )).limit(1);
  if (!existing) throw new ControlPlaneError('period_not_found', 'Accounting period not found.');
  const [saved] = await exec.update(accountingPeriod).set({
    status,
    lockedAt: status === 'locked' ? new Date() : null,
    lockedByUserId: status === 'locked' ? actor.userId : null,
    version: existing.version + 1,
    updatedAt: new Date(),
  }).where(eq(accountingPeriod.id, existing.id)).returning();
  await appendAudit(exec, {
    ...scope, actorUserId: actor.userId, requestId: actor.requestId,
    entity: 'accounting_period', entityId: id, action: status === 'locked' ? 'lock' : 'reopen',
    before: existing, after: saved,
  });
  return saved;
}
