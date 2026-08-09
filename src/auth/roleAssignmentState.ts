import { and, gt, isNull, lte, or } from 'drizzle-orm';
import { userCompanyRole } from '../data/schema';

/** A role assignment is live only inside its half-open validity window and before revocation. */
export function activeRoleAssignmentCondition(now = new Date()) {
  return and(
    lte(userCompanyRole.validFrom, now),
    or(isNull(userCompanyRole.validUntil), gt(userCompanyRole.validUntil, now)),
    isNull(userCompanyRole.revokedAt),
  );
}
