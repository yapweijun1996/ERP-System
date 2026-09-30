import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { businessUnit, company, employee, hrPosition } from '../../data/schema';
import { appendAudit } from '../../api/audit';

export type OrganizationKind = 'business_unit' | 'position';
export interface OrganizationActor { userId: number; requestId: string }
export class OrganizationError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 422) { super(message); }
}
function master(kind: OrganizationKind) {
  if (kind === 'business_unit') return businessUnit;
  if (kind === 'position') return hrPosition;
  throw new OrganizationError('organization_kind_invalid', 'Unknown organization master.');
}
function text(value: unknown, label: string, maximum: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum
    || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new OrganizationError('organization_validation_failed', `${label} is required and must be valid bounded text.`);
  }
  return value.trim();
}
function id(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new OrganizationError('organization_validation_failed', 'A positive integer identifier is required.');
  }
  return Number(value);
}
export async function listOrganizationWithin(exec: DB, scope: Scope, kind: OrganizationKind) {
  const table = master(kind);
  return exec.select().from(table).where(and(
    eq(table.masterFn, scope.masterFn), eq(table.companyFn, scope.companyFn),
  )).orderBy(table.code).limit(500);
}
/** Call inside a tenant transaction after company-scoped HR write authorization. */
export async function saveOrganizationWithin(
  exec: DB, scope: Scope, actor: OrganizationActor, kind: OrganizationKind,
  input: { id?: number; code: unknown; name: unknown; isActive: unknown; expectedVersion: unknown },
) {
  const table = master(kind);
  const code = text(input.code, 'Code', 40).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) throw new OrganizationError('organization_validation_failed', 'Code must contain letters, numbers, underscores or hyphens.');
  const name = text(input.name, 'Name', 120);
  if (typeof input.isActive !== 'boolean') throw new OrganizationError('organization_validation_failed', 'Active state must be explicit.');
  const [tenant] = await exec.select({ fn: company.companyFn }).from(company).where(and(
    eq(company.masterFn, scope.masterFn), eq(company.companyFn, scope.companyFn),
  )).limit(1);
  if (!tenant) throw new OrganizationError('organization_not_found', 'Active company not found.', 404);
  const [previous] = input.id == null ? [] : await exec.select().from(table).where(and(
    eq(table.masterFn, scope.masterFn), eq(table.companyFn, scope.companyFn), eq(table.id, id(input.id)),
  )).limit(1).for('update');
  if (input.id != null && !previous) throw new OrganizationError('organization_not_found', 'Organization master not found.', 404);
  if (input.expectedVersion !== (previous?.version ?? 0)) throw new OrganizationError('organization_version_conflict', 'Organization master changed. Reload and retry.', 409);
  const [duplicate] = await exec.select({ id: table.id }).from(table).where(and(
    eq(table.masterFn, scope.masterFn), eq(table.companyFn, scope.companyFn), eq(table.code, code),
  )).limit(1);
  if (duplicate && duplicate.id !== previous?.id) throw new OrganizationError('organization_code_conflict', 'Code already exists in this company.', 409);
  const values = { code, name, isActive: input.isActive, version: (previous?.version ?? 0) + 1, updatedAt: new Date() };
  const [saved] = previous
    ? await exec.update(table).set(values).where(eq(table.id, previous.id)).returning()
    : await exec.insert(table).values({ ...scope, ...values }).returning();
  await appendAudit(exec, { ...scope, actorUserId: actor.userId, requestId: actor.requestId,
    entity: `hr_${kind}`, entityId: saved.id, action: previous ? 'update' : 'create', before: previous ?? null, after: saved });
  return saved;
}
export async function assignEmployeeOrganizationWithin(
  exec: DB, scope: Scope, actor: OrganizationActor,
  input: { employeeId: number; businessUnitId: number | null; positionId: number | null; expectedVersion: number; reason: unknown },
) {
  const reason = text(input.reason, 'Reason', 500);
  const [staff] = await exec.select().from(employee).where(and(
    eq(employee.masterFn, scope.masterFn), eq(employee.companyFn, scope.companyFn), eq(employee.id, id(input.employeeId)),
  )).limit(1).for('update');
  if (!staff) throw new OrganizationError('employee_not_found', 'Employee not found.', 404);
  if (!staff.isActive) throw new OrganizationError('employee_inactive', 'Former staff cannot receive an organization assignment.', 409);
  if (staff.organizationVersion !== input.expectedVersion) throw new OrganizationError('organization_version_conflict', 'Employee assignment changed. Reload and retry.', 409);
  // Lock referenced masters so concurrent deactivation and assignment serialize.
  for (const [kind, targetId] of [['business_unit', input.businessUnitId], ['position', input.positionId]] as const) {
    if (targetId === null) continue;
    const table = master(kind);
    const [target] = await exec.select({ id: table.id, isActive: table.isActive }).from(table).where(and(
      eq(table.masterFn, scope.masterFn), eq(table.companyFn, scope.companyFn), eq(table.id, id(targetId)),
    )).limit(1).for('update');
    if (!target?.isActive) throw new OrganizationError('organization_target_unavailable', 'Choose an active organization master in this company.');
  }
  const [saved] = await exec.update(employee).set({ businessUnitId: input.businessUnitId,
    positionId: input.positionId, organizationVersion: staff.organizationVersion + 1, updatedAt: new Date() })
    .where(eq(employee.id, staff.id)).returning();
  await appendAudit(exec, { ...scope, actorUserId: actor.userId, requestId: actor.requestId,
    entity: 'employee', entityId: staff.id, action: 'organization_assignment',
    before: { businessUnitId: staff.businessUnitId, positionId: staff.positionId, version: staff.organizationVersion },
    after: { businessUnitId: saved.businessUnitId, positionId: saved.positionId, version: saved.organizationVersion, reason } });
  return saved;
}
