// Downstream purchasing tests often need an already-approved order but do not test
// the approval workflow itself. Keep that fixture transition explicit and local to
// tests; production code must always use decidePurchaseOrderWithin.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../data/db';
import type { Scope } from '../data/repo';
import { purchaseOrder, purchaseOrderApproval } from '../data/schema';

export async function markPurchaseOrderApprovedForFixture(
  db: DB,
  scope: Scope,
  orderId: number,
) {
  await db.transaction(async (tx) => {
    await tx.update(purchaseOrderApproval).set({
      status: 'approved',
      decisionNote: 'Approved by downstream test fixture',
      version: sql`${purchaseOrderApproval.version} + 1`,
      decidedAt: sql`now()`,
      updatedAt: sql`now()`,
    }).where(and(
      eq(purchaseOrderApproval.masterFn, scope.masterFn),
      eq(purchaseOrderApproval.companyFn, scope.companyFn),
      eq(purchaseOrderApproval.orderId, orderId),
    ));
    await tx.update(purchaseOrder).set({
      status: 'open',
      version: sql`${purchaseOrder.version} + 1`,
      updatedAt: sql`now()`,
    }).where(and(
      eq(purchaseOrder.masterFn, scope.masterFn),
      eq(purchaseOrder.companyFn, scope.companyFn),
      eq(purchaseOrder.id, orderId),
    ));
  });
}
