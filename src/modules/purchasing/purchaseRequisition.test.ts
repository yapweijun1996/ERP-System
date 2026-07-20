import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { product } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  createPurchaseRequisition,
  decidePurchaseRequisition,
  PurchaseRequisitionError,
} from './purchaseRequisition';

async function fixtureProduct(db: DB) {
  const [row] = await db.insert(product).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    sku: 'PR-WIDGET', name: 'Fictional Widget', uom: 'unit',
  }).returning({ id: product.id });
  return row;
}

describe('purchase requisitions', () => {
  it('creates a requisition that always starts submitted, with a computed estimated value', async () => {
    const db = await freshDb();
    const widget = await fixtureProduct(db);
    const created = await createPurchaseRequisition(db, SCOPE, {
      reqNo: 'PR-1',
      requestedByName: 'Fictional Requester',
      department: 'Fictional Department',
      neededByDate: '2026-08-01',
      priority: 'Urgent',
      lines: [{ productId: widget.id, qty: 10, estimatedUnitCost: 6.5 }],
    });
    expect(created).toMatchObject({ reqNo: 'PR-1', status: 'submitted' });
  });

  it('rejects an unknown priority', async () => {
    const db = await freshDb();
    const widget = await fixtureProduct(db);
    await expect(createPurchaseRequisition(db, SCOPE, {
      reqNo: 'PR-BADPRIORITY',
      requestedByName: 'Fictional Requester',
      department: 'Fictional Department',
      neededByDate: '2026-08-01',
      priority: 'Whenever',
      lines: [{ productId: widget.id, qty: 1, estimatedUnitCost: 1 }],
    })).rejects.toThrow(PurchaseRequisitionError);
  });

  it('rejects a requisition with no lines', async () => {
    const db = await freshDb();
    await expect(createPurchaseRequisition(db, SCOPE, {
      reqNo: 'PR-NOLINES',
      requestedByName: 'Fictional Requester',
      department: 'Fictional Department',
      neededByDate: '2026-08-01',
      lines: [],
    })).rejects.toThrow('at least one line');
  });

  it('rejects a product that does not belong to this company', async () => {
    const db = await freshDb();
    await expect(createPurchaseRequisition(db, SCOPE, {
      reqNo: 'PR-BADPRODUCT',
      requestedByName: 'Fictional Requester',
      department: 'Fictional Department',
      neededByDate: '2026-08-01',
      lines: [{ productId: 999999, qty: 1, estimatedUnitCost: 1 }],
    })).rejects.toThrow(PurchaseRequisitionError);
  });

  it('approves a submitted requisition', async () => {
    const db = await freshDb();
    const widget = await fixtureProduct(db);
    const created = await createPurchaseRequisition(db, SCOPE, {
      reqNo: 'PR-APPROVE',
      requestedByName: 'Fictional Requester',
      department: 'Fictional Department',
      neededByDate: '2026-08-01',
      lines: [{ productId: widget.id, qty: 1, estimatedUnitCost: 1 }],
    });
    const decided = await decidePurchaseRequisition(db, SCOPE, created.id, 'approved');
    expect(decided.status).toBe('approved');
  });

  it('rejects a submitted requisition with a real reason', async () => {
    const db = await freshDb();
    const widget = await fixtureProduct(db);
    const created = await createPurchaseRequisition(db, SCOPE, {
      reqNo: 'PR-REJECT',
      requestedByName: 'Fictional Requester',
      department: 'Fictional Department',
      neededByDate: '2026-08-01',
      lines: [{ productId: widget.id, qty: 1, estimatedUnitCost: 1 }],
    });
    const decided = await decidePurchaseRequisition(db, SCOPE, created.id, 'rejected', 'Over budget this quarter.');
    expect(decided).toMatchObject({ status: 'rejected', rejectionReason: 'Over budget this quarter.' });
  });

  it('rejects rejecting without a reason', async () => {
    const db = await freshDb();
    const widget = await fixtureProduct(db);
    const created = await createPurchaseRequisition(db, SCOPE, {
      reqNo: 'PR-REJECT-EMPTY',
      requestedByName: 'Fictional Requester',
      department: 'Fictional Department',
      neededByDate: '2026-08-01',
      lines: [{ productId: widget.id, qty: 1, estimatedUnitCost: 1 }],
    });
    await expect(decidePurchaseRequisition(db, SCOPE, created.id, 'rejected', '  '))
      .rejects.toThrow('rejectionReason is required');
  });

  it('rejects deciding an already-decided requisition', async () => {
    const db = await freshDb();
    const widget = await fixtureProduct(db);
    const created = await createPurchaseRequisition(db, SCOPE, {
      reqNo: 'PR-DECIDE-TWICE',
      requestedByName: 'Fictional Requester',
      department: 'Fictional Department',
      neededByDate: '2026-08-01',
      lines: [{ productId: widget.id, qty: 1, estimatedUnitCost: 1 }],
    });
    await decidePurchaseRequisition(db, SCOPE, created.id, 'approved');
    await expect(decidePurchaseRequisition(db, SCOPE, created.id, 'rejected', 'Too late'))
      .rejects.toThrow(PurchaseRequisitionError);
  });
});
