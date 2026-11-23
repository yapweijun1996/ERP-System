import {
  and, eq, isNull, or,
} from 'drizzle-orm';
import type { DB } from '../data/db';
import { appUser, role, userCompanyRole } from '../data/schema';
import {
  COMPANY_OWNER_ROLE_TEMPLATE_KEY,
  roleAssignmentCanAuthorize,
} from './accessCatalog';
import { AuthLifecycleError } from './authErrors';
import { activeRoleAssignmentCondition } from './roleAssignmentState';
import type { SessionData } from './session';

export async function provisionedCompanyOwnerUserIdsWithin(
  exec: DB,
  masterFn: string,
  companyFn: string,
  now = new Date(),
): Promise<Set<number>> {
  const assignments = await exec.select({
    userId: userCompanyRole.userId,
    assignedByUserId: userCompanyRole.assignedByUserId,
    assignmentSource: userCompanyRole.assignmentSource,
    isSuperadmin: role.isSuperadmin,
    sourceTemplateKey: role.sourceTemplateKey,
  }).from(userCompanyRole)
    .innerJoin(appUser, eq(appUser.userId, userCompanyRole.userId))
    .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
    .where(and(
      eq(userCompanyRole.companyFn, companyFn),
      eq(appUser.masterFn, masterFn),
      eq(appUser.isActive, true),
      eq(appUser.identityKind, 'human'),
      eq(role.masterFn, masterFn),
      or(eq(role.companyFn, companyFn), isNull(role.companyFn)),
      eq(role.sourceTemplateKey, COMPANY_OWNER_ROLE_TEMPLATE_KEY),
      activeRoleAssignmentCondition(now),
    ));
  return new Set(assignments.filter(roleAssignmentCanAuthorize).map((row) => row.userId));
}

export async function hasProvisionedCompanyOwnerAuthorityWithin(
  exec: DB,
  session: SessionData,
  now = new Date(),
): Promise<boolean> {
  return (await provisionedCompanyOwnerUserIdsWithin(
    exec, session.masterFn, session.activeCompanyFn, now,
  )).has(session.userId);
}

export async function assertProvisionedCompanyOwnerAuthorityWithin(
  exec: DB,
  session: SessionData,
  now = new Date(),
): Promise<void> {
  if (!await hasProvisionedCompanyOwnerAuthorityWithin(exec, session, now)) {
    throw new AuthLifecycleError(
      403,
      'delegation_authority_required',
      'Only the provisioned Company Owner can grant this authority.',
    );
  }
}
