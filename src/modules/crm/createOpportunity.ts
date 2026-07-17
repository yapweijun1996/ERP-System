// CRM — create an opportunity: a single-value pipeline estimate, no line items yet.
// See src/data/schema/crm.ts's header comment: exact product lines are decided at
// conversion time (convertOpportunityToSalesOrder.ts), not when a deal is first
// estimated — a plain insert is enough here, no cross-module transaction needed.
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { opportunity } from '../../data/schema';

export interface CreateOpportunityInput {
  docNo: string;
  customerId: number;
  title: string;
  value: number;
  currency: string;
  closeDate: string; // YYYY-MM-DD
  probability?: number;
  ownerUserId?: number;
}

export async function createOpportunity(db: DB, scope: Scope, input: CreateOpportunityInput) {
  const [row] = await db.insert(opportunity).values({
    masterFn: scope.masterFn, companyFn: scope.companyFn,
    docNo: input.docNo, customerId: input.customerId, title: input.title,
    value: input.value.toFixed(2), currency: input.currency,
    stage: 'lead', probability: String(input.probability ?? 0),
    closeDate: input.closeDate, ownerUserId: input.ownerUserId ?? null,
  }).returning({ id: opportunity.id });
  return { opportunityId: row.id };
}
