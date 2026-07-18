// CRM — create an opportunity: a single-value pipeline estimate, no line items yet.
// See src/data/schema/crm.ts's header comment: exact product lines are decided at
// conversion time (convertOpportunityToSalesOrder.ts), not when a deal is first
// estimated — a plain insert is enough here, no cross-module transaction needed.
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { customer, opportunity } from '../../data/schema';
import { InvalidOpportunityStateError } from './errors';

export interface CreateOpportunityInput {
  docNo: string;
  customerId: number;
  title: string;
  value: number;
  currency: string;
  closeDate: string; // YYYY-MM-DD
  stage?: 'lead' | 'qualified' | 'proposal' | 'negotiation';
  probability?: number;
  ownerUserId?: number;
}

export async function createOpportunity(db: DB, scope: Scope, input: CreateOpportunityInput) {
  const [scopedCustomer] = await db.select({ id: customer.id })
    .from(customer)
    .where(and(
      eq(customer.id, input.customerId),
      eq(customer.masterFn, scope.masterFn),
      eq(customer.companyFn, scope.companyFn),
    ))
    .limit(1);
  if (!scopedCustomer) {
    throw new InvalidOpportunityStateError(
      'The selected customer does not belong to the active company.',
    );
  }
  const [row] = await db.insert(opportunity).values({
    masterFn: scope.masterFn, companyFn: scope.companyFn,
    docNo: input.docNo, customerId: input.customerId, title: input.title,
    value: input.value.toFixed(2), currency: input.currency,
    stage: input.stage ?? 'lead', probability: String(input.probability ?? 0),
    closeDate: input.closeDate, ownerUserId: input.ownerUserId ?? null,
  }).returning({ id: opportunity.id });
  return { id: row.id, opportunityId: row.id, docNo: input.docNo };
}
