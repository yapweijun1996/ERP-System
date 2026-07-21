// CRM activity log shared by Customer-360 and Opportunity Detail. An activity may
// target a customer, an opportunity, or both. When both are supplied they must
// describe the same relationship so a single note can appear in both timelines.
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { activity, customer, opportunity } from '../../data/schema';

export class InvalidActivityStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidActivityStateError';
  }
}

const ACTIVITY_KINDS = ['note', 'call', 'email', 'system'] as const;

export interface CreateActivityInput {
  customerId?: number;
  opportunityId?: number;
  kind: string;
  body: string;
}

/** Compatibility alias retained for the existing Customer-360 caller. */
export type CreateCustomerActivityInput = CreateActivityInput;

export async function createCustomerActivityWithin(
  exec: DB,
  scope: Scope,
  input: CreateActivityInput,
) {
  if (!input.body?.trim()) throw new InvalidActivityStateError('Activity body is required.');
  if (!ACTIVITY_KINDS.includes(input.kind as typeof ACTIVITY_KINDS[number])) {
    throw new InvalidActivityStateError(`kind must be one of: ${ACTIVITY_KINDS.join(', ')}`);
  }
  if (input.customerId == null && input.opportunityId == null) {
    throw new InvalidActivityStateError('A customer or opportunity target is required.');
  }

  let scopedCustomerId: number | null = null;
  if (input.customerId != null) {
    const [scopedCustomer] = await exec.select({ id: customer.id })
      .from(customer)
      .where(and(
        eq(customer.id, input.customerId),
        eq(customer.masterFn, scope.masterFn),
        eq(customer.companyFn, scope.companyFn),
      ))
      .limit(1);
    if (!scopedCustomer) {
      throw new InvalidActivityStateError(
        'The selected customer does not belong to the active company.',
      );
    }
    scopedCustomerId = scopedCustomer.id;
  }

  if (input.opportunityId != null) {
    const [scopedOpportunity] = await exec.select({
      id: opportunity.id,
      customerId: opportunity.customerId,
    }).from(opportunity).where(and(
      eq(opportunity.id, input.opportunityId),
      eq(opportunity.masterFn, scope.masterFn),
      eq(opportunity.companyFn, scope.companyFn),
    )).limit(1);
    if (!scopedOpportunity) {
      throw new InvalidActivityStateError(
        'The selected opportunity does not belong to the active company.',
      );
    }
    if (scopedCustomerId != null && scopedCustomerId !== scopedOpportunity.customerId) {
      throw new InvalidActivityStateError(
        'The selected opportunity does not belong to the selected customer.',
      );
    }
  }

  const [row] = await exec.insert(activity).values({
    masterFn: scope.masterFn, companyFn: scope.companyFn,
    customerId: input.customerId ?? null,
    opportunityId: input.opportunityId ?? null,
    kind: input.kind,
    body: input.body.trim(),
  }).returning({ id: activity.id });
  return { id: row.id };
}
