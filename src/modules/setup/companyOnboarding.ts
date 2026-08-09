import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  accountingPeriod, appUser, company, companyModule, companyOnboarding,
  onboardingImportJob, role, userCompanyRole, warehouse,
} from '../../data/schema';
import { appendAudit } from '../../api/audit';
import type { SessionData } from '../../auth/session';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { MODULE_DEPENDENCIES, type ModuleKey } from '../../auth/moduleAccess';
import { activeRoleAssignmentCondition } from '../../auth/roleAssignmentState';

export const ONBOARDING_STAGES = [
  'company', 'fiscal', 'warehouse', 'modules', 'roles', 'staff',
  'import', 'opening_balance', 'uat', 'live',
] as const;
export type OnboardingStage = typeof ONBOARDING_STAGES[number];

export class CompanyOnboardingError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'CompanyOnboardingError';
  }
}

function isStage(value: string): value is OnboardingStage {
  return (ONBOARDING_STAGES as readonly string[]).includes(value);
}

export async function readCompanyOnboardingWithin(
  exec: DB,
  session: SessionData,
) {
  const [row] = await exec.select().from(companyOnboarding).where(and(
    eq(companyOnboarding.masterFn, session.masterFn),
    eq(companyOnboarding.companyFn, session.activeCompanyFn),
  )).limit(1);
  if (!row) {
    throw new CompanyOnboardingError(404, 'onboarding_not_found', 'Company onboarding state was not found.');
  }
  return {
    ...row,
    completedSteps: row.completedSteps as OnboardingStage[],
    stages: ONBOARDING_STAGES,
  };
}

export async function completeCompanyOnboardingStageWithin(
  exec: DB,
  session: SessionData,
  stage: string,
  expectedVersion: number,
  requestId: string,
) {
  if (!isStage(stage) || stage === 'live') {
    throw new CompanyOnboardingError(400, 'invalid_onboarding_stage', 'Choose a valid setup stage.');
  }
  const current = await readCompanyOnboardingWithin(exec, session);
  if (current.status === 'live') {
    throw new CompanyOnboardingError(409, 'company_already_live', 'This company is already live.');
  }
  if (current.version !== expectedVersion) {
    throw new CompanyOnboardingError(409, 'version_conflict', 'Reload the setup checklist and try again.');
  }
  const completed = new Set(current.completedSteps);
  const index = ONBOARDING_STAGES.indexOf(stage);
  const missing = ONBOARDING_STAGES.slice(0, index).filter((step) => !completed.has(step));
  if (missing.length) {
    throw new CompanyOnboardingError(409, 'onboarding_stage_out_of_order', `Complete ${missing[0]} first.`);
  }
  completed.add(stage);
  const next = ONBOARDING_STAGES.find((candidate) => !completed.has(candidate)) ?? 'live';
  const [updated] = await exec.update(companyOnboarding).set({
    completedSteps: [...completed],
    currentStage: next,
    version: current.version + 1,
    updatedAt: new Date(),
  }).where(and(
    eq(companyOnboarding.masterFn, session.masterFn),
    eq(companyOnboarding.companyFn, session.activeCompanyFn),
    eq(companyOnboarding.version, expectedVersion),
  )).returning();
  if (!updated) throw new CompanyOnboardingError(409, 'version_conflict', 'Reload the setup checklist and try again.');
  await appendAudit(exec, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
    actorUserId: session.userId, requestId,
    entity: 'company_onboarding', entityId: session.activeCompanyFn,
    action: 'stage_completed', before: { currentStage: current.currentStage },
    after: { completedStage: stage, currentStage: next, version: updated.version },
  });
  return { ...updated, completedSteps: updated.completedSteps as OnboardingStage[], stages: ONBOARDING_STAGES };
}

async function goLiveBlockers(exec: DB, session: SessionData, now = new Date()): Promise<string[]> {
  const blockers: string[] = [];
  const state = await readCompanyOnboardingWithin(exec, session);
  const completed = new Set(state.completedSteps);
  for (const stage of ONBOARDING_STAGES.slice(0, -1)) {
    if (!completed.has(stage)) blockers.push(`stage:${stage}`);
  }
  const [companyRow] = await exec.select({
    fiscalYearStart: company.fiscalYearStart,
  }).from(company).where(and(
    eq(company.masterFn, session.masterFn), eq(company.companyFn, session.activeCompanyFn),
  )).limit(1);
  if (!companyRow?.fiscalYearStart) blockers.push('company:fiscal_year_start');
  const [period] = await exec.select({ n: sql<number>`count(*)::int` }).from(accountingPeriod).where(and(
    eq(accountingPeriod.masterFn, session.masterFn), eq(accountingPeriod.companyFn, session.activeCompanyFn),
  ));
  if (!(period?.n ?? 0)) blockers.push('fiscal:accounting_period');
  const [warehouseRow] = await exec.select({ n: sql<number>`count(*)::int` }).from(warehouse).where(and(
    eq(warehouse.masterFn, session.masterFn), eq(warehouse.companyFn, session.activeCompanyFn),
  ));
  if (!(warehouseRow?.n ?? 0)) blockers.push('warehouse:required');
  const roles = await exec.select({ id: role.roleId, isSuperadmin: role.isSuperadmin }).from(role).where(and(
    eq(role.masterFn, session.masterFn), eq(role.companyFn, session.activeCompanyFn),
  ));
  if (roles.length < 2) blockers.push('roles:company_roles');
  const [activeSuperadmin] = await exec.select({ userId: appUser.userId }).from(appUser)
    .innerJoin(userCompanyRole, eq(userCompanyRole.userId, appUser.userId))
    .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
    .where(and(
      eq(appUser.masterFn, session.masterFn), eq(appUser.isActive, true),
      eq(userCompanyRole.companyFn, session.activeCompanyFn),
      eq(role.companyFn, session.activeCompanyFn), eq(role.isSuperadmin, true),
      activeRoleAssignmentCondition(now),
    )).limit(1);
  if (!activeSuperadmin) blockers.push('roles:active_superadmin');
  const modules = await exec.select().from(companyModule).where(and(
    eq(companyModule.masterFn, session.masterFn), eq(companyModule.companyFn, session.activeCompanyFn),
  ));
  const enabled = new Set(modules.filter((item) => item.enabled).map((item) => item.moduleKey));
  for (const moduleKey of enabled) {
    for (const dependency of MODULE_DEPENDENCIES[moduleKey as ModuleKey] ?? []) {
      if (!enabled.has(dependency)) blockers.push(`modules:${moduleKey}->${dependency}`);
    }
  }
  const [invalidImport] = await exec.select({ id: onboardingImportJob.id }).from(onboardingImportJob).where(and(
    eq(onboardingImportJob.masterFn, session.masterFn),
    eq(onboardingImportJob.companyFn, session.activeCompanyFn),
    eq(onboardingImportJob.status, 'invalid'),
  )).limit(1);
  if (invalidImport) blockers.push('import:invalid_job');
  return [...new Set(blockers)];
}

export async function goLiveCompanyWithin(
  exec: DB,
  session: SessionData,
  expectedVersion: number,
  requestId: string,
  now = new Date(),
) {
  const current = await readCompanyOnboardingWithin(exec, session);
  if (current.status === 'live') return current;
  if (current.version !== expectedVersion) {
    throw new CompanyOnboardingError(409, 'version_conflict', 'Reload the setup checklist and try again.');
  }
  const blockers = await goLiveBlockers(exec, session, now);
  if (blockers.length) {
    throw new CompanyOnboardingError(422, 'go_live_blocked', 'Complete every setup control before Go Live.', {
      blockers: blockers.join(','),
    });
  }
  const [updated] = await exec.update(companyOnboarding).set({
    status: 'live', currentStage: 'live',
    completedSteps: ONBOARDING_STAGES,
    goLiveAt: now, goLiveByUserId: session.userId,
    version: current.version + 1, updatedAt: now,
  }).where(and(
    eq(companyOnboarding.masterFn, session.masterFn),
    eq(companyOnboarding.companyFn, session.activeCompanyFn),
    eq(companyOnboarding.version, expectedVersion),
  )).returning();
  if (!updated) throw new CompanyOnboardingError(409, 'version_conflict', 'Reload the setup checklist and try again.');
  await appendAudit(exec, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
    actorUserId: session.userId, requestId,
    entity: 'company_onboarding', entityId: session.activeCompanyFn,
    action: 'go_live', before: { status: current.status },
    after: { status: 'live', goLiveAt: now.toISOString(), version: updated.version },
  });
  return { ...updated, completedSteps: updated.completedSteps as OnboardingStage[], stages: ONBOARDING_STAGES };
}

export function completeCompanyOnboardingStage(
  db: DB, session: SessionData, stage: string, expectedVersion: number, requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
  }, (tx) =>
    completeCompanyOnboardingStageWithin(tx, session, stage, expectedVersion, requestId));
}

export function goLiveCompany(
  db: DB, session: SessionData, expectedVersion: number, requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn, companyFn: session.activeCompanyFn,
  }, (tx) =>
    goLiveCompanyWithin(tx, session, expectedVersion, requestId));
}
