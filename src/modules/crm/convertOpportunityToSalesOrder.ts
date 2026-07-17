// CRM — convert an opportunity into a real sales order: the cross-module moment a
// pipeline estimate becomes a committed order (stock issue + invoice + GL), composed
// with the opportunity's own stage update in ONE transaction via
// confirmSalesOrderWithin (the same composable core sales screens use directly).
// Guards against converting the same opportunity twice, mirroring
// purchasing/receiveGoods.ts's open/received discipline. See docs/DATA_MODEL.md §4.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { opportunity } from '../../data/schema';
import { confirmSalesOrderWithin, type OrderLineInput } from '../sales/confirmOrder';
import { InvalidOpportunityStateError } from './errors';

export interface ConvertOpportunityInput {
  opportunityId: number;
  docNo: string;
  orderDate: string; // YYYY-MM-DD
  lines: OrderLineInput[];
}

export async function convertOpportunityToSalesOrder(db: DB, scope: Scope, input: ConvertOpportunityInput) {
  return db.transaction(async (tx) => {
    const [opp] = await tx
      .select({
        id: opportunity.id, stage: opportunity.stage,
        customerId: opportunity.customerId, currency: opportunity.currency,
      })
      .from(opportunity)
      .where(and(
        eq(opportunity.masterFn, scope.masterFn),
        eq(opportunity.companyFn, scope.companyFn),
        eq(opportunity.id, input.opportunityId),
      ))
      .for('update'); // row lock: a concurrent conversion attempt waits here until we commit

    if (!opp) throw new InvalidOpportunityStateError(`Opportunity ${input.opportunityId} not found`);
    if (opp.stage === 'won' || opp.stage === 'lost') {
      throw new InvalidOpportunityStateError(
        `Opportunity ${input.opportunityId} is '${opp.stage}' — cannot convert twice`,
      ); // → ROLLBACK
    }

    const result = await confirmSalesOrderWithin(tx, scope, {
      docNo: input.docNo, customerId: opp.customerId, orderDate: input.orderDate,
      currency: opp.currency, lines: input.lines,
    });

    await tx.update(opportunity)
      .set({ stage: 'won', orderId: result.orderId, updatedAt: sql`now()` })
      .where(eq(opportunity.id, opp.id));

    return { ...result, opportunityId: opp.id };
  });
}
