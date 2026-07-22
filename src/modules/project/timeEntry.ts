import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { appUser, project, projectTimeEntry, userCompany } from '../../data/schema';
import { fixedString, fixedUnits } from '../inventory/decimal';

export class ProjectTimeEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectTimeEntryError';
  }
}

export interface CreateProjectTimeEntryInput {
  projectId: number;
  workDate: string;
  task: string;
  hours: string | number;
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

async function requireActorCompanyAccess(
  exec: DB,
  scope: Scope,
  actorUserId: number,
): Promise<void> {
  if (!Number.isSafeInteger(actorUserId) || actorUserId <= 0) {
    throw new ProjectTimeEntryError('An authenticated user is required.');
  }
  const [actor] = await exec.select({ id: appUser.userId }).from(appUser)
    .innerJoin(userCompany, eq(userCompany.userId, appUser.userId))
    .where(and(
      eq(appUser.userId, actorUserId),
      eq(appUser.masterFn, scope.masterFn),
      eq(appUser.isActive, true),
      eq(userCompany.companyFn, scope.companyFn),
    ))
    .limit(1);
  if (!actor) throw new ProjectTimeEntryError('The user is unavailable in this company.');
}

export async function createProjectTimeEntryWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  input: CreateProjectTimeEntryInput,
) {
  await requireActorCompanyAccess(exec, scope, actorUserId);
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0) {
    throw new ProjectTimeEntryError('projectId must be a positive integer.');
  }
  const workDate = String(input.workDate ?? '').trim();
  if (!validIsoDate(workDate)) {
    throw new ProjectTimeEntryError('workDate must be a real date in YYYY-MM-DD format.');
  }
  const task = String(input.task ?? '').trim();
  if (!task) throw new ProjectTimeEntryError('task is required.');
  if (task.length > 200) throw new ProjectTimeEntryError('task must be 200 characters or fewer.');

  let hourUnits: bigint;
  try {
    hourUnits = fixedUnits(input.hours, 2);
  } catch {
    throw new ProjectTimeEntryError('hours must be a decimal with at most two decimal places.');
  }
  if (hourUnits <= 0n || hourUnits > 2400n) {
    throw new ProjectTimeEntryError('hours must be greater than 0 and no more than 24.');
  }

  const [targetProject] = await exec.select({ id: project.id, status: project.status })
    .from(project)
    .where(and(
      eq(project.masterFn, scope.masterFn),
      eq(project.companyFn, scope.companyFn),
      eq(project.id, input.projectId),
    ))
    .limit(1);
  if (!targetProject) {
    throw new ProjectTimeEntryError('Project is unavailable in this company.');
  }
  if (targetProject.status !== 'open') {
    throw new ProjectTimeEntryError('Time can only be logged to an open project.');
  }

  const [entry] = await exec.insert(projectTimeEntry).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    actorUserId,
    projectId: targetProject.id,
    workDate,
    task,
    hours: fixedString(hourUnits, 2),
  }).returning({
    id: projectTimeEntry.id,
    actorUserId: projectTimeEntry.actorUserId,
    projectId: projectTimeEntry.projectId,
    workDate: projectTimeEntry.workDate,
    task: projectTimeEntry.task,
    hours: projectTimeEntry.hours,
    status: projectTimeEntry.status,
    version: projectTimeEntry.version,
  });
  return entry;
}

export async function voidProjectTimeEntryWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  entryId: number,
  reason: string,
) {
  await requireActorCompanyAccess(exec, scope, actorUserId);
  if (!Number.isSafeInteger(entryId) || entryId <= 0) {
    throw new ProjectTimeEntryError('entryId must be a positive integer.');
  }
  const normalizedReason = String(reason ?? '').trim();
  if (!normalizedReason) throw new ProjectTimeEntryError('A void reason is required.');
  if (normalizedReason.length > 300) {
    throw new ProjectTimeEntryError('The void reason must be 300 characters or fewer.');
  }

  const [entry] = await exec.select({
    id: projectTimeEntry.id,
    actorUserId: projectTimeEntry.actorUserId,
    status: projectTimeEntry.status,
  }).from(projectTimeEntry).where(and(
    eq(projectTimeEntry.masterFn, scope.masterFn),
    eq(projectTimeEntry.companyFn, scope.companyFn),
    eq(projectTimeEntry.id, entryId),
  )).for('update');
  if (!entry || entry.actorUserId !== actorUserId) {
    throw new ProjectTimeEntryError('Time entry is unavailable for this user.');
  }
  if (entry.status !== 'active') {
    throw new ProjectTimeEntryError('Only an active time entry can be voided.');
  }

  const [voided] = await exec.update(projectTimeEntry).set({
    status: 'voided',
    version: sql`${projectTimeEntry.version} + 1`,
    voidReason: normalizedReason,
    voidedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(projectTimeEntry.masterFn, scope.masterFn),
    eq(projectTimeEntry.companyFn, scope.companyFn),
    eq(projectTimeEntry.id, entry.id),
    eq(projectTimeEntry.actorUserId, actorUserId),
    eq(projectTimeEntry.status, 'active'),
  )).returning({
    id: projectTimeEntry.id,
    status: projectTimeEntry.status,
    version: projectTimeEntry.version,
    voidReason: projectTimeEntry.voidReason,
    voidedAt: projectTimeEntry.voidedAt,
  });
  if (!voided) throw new ProjectTimeEntryError('Time entry changed before it could be voided.');
  return voided;
}

export function createProjectTimeEntry(
  db: DB,
  scope: Scope,
  actorUserId: number,
  input: CreateProjectTimeEntryInput,
) {
  return db.transaction((tx) => createProjectTimeEntryWithin(tx, scope, actorUserId, input));
}

export function voidProjectTimeEntry(
  db: DB,
  scope: Scope,
  actorUserId: number,
  entryId: number,
  reason: string,
) {
  return db.transaction((tx) =>
    voidProjectTimeEntryWithin(tx, scope, actorUserId, entryId, reason));
}
