// Purchasing — post a supplier invoice: balanced double-entry GL (Dr Inventory,
// Dr Input Tax [recoverable], Cr Accounts Payable), mirroring confirmOrder.ts's
// GL-posting discipline. Requires the PO to already be 'received' — posting AP for
// goods that were never received would be a real accounting error, not just a
// demo shortcut — so this doubles as this module's second rollback-guard scenario
// alongside receiveGoods.ts's double-receipt guard. See docs/DATA_MODEL.md §4.
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { account, glEntry, purchaseOrder, supplierInvoice } from '../../data/schema';
import { InvalidPurchaseOrderStateError, PostingError } from './errors';

export interface PostSupplierInvoiceInput {
  purchaseOrderId: number;
  docNo: string;
  invoiceDate: string; // YYYY-MM-DD
}

const money = (n: number) => n.toFixed(2);

async function accountIdByCode(exec: DB, scope: Scope, code: string): Promise<number> {
  const [a] = await exec
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.masterFn, scope.masterFn), eq(account.companyFn, scope.companyFn), eq(account.code, code)));
  if (!a) throw new PostingError(`Account ${code} not configured`);
  return a.id;
}

export async function postSupplierInvoiceWithin(exec: DB, scope: Scope, input: PostSupplierInvoiceInput) {
  const [order] = await exec
    .select({
      id: purchaseOrder.id, status: purchaseOrder.status, supplierId: purchaseOrder.supplierId,
      currency: purchaseOrder.currency, projectId: purchaseOrder.projectId,
      netAmount: purchaseOrder.netAmount, taxAmount: purchaseOrder.taxAmount, totalAmount: purchaseOrder.totalAmount,
    })
    .from(purchaseOrder)
    .where(and(
      eq(purchaseOrder.masterFn, scope.masterFn),
      eq(purchaseOrder.companyFn, scope.companyFn),
      eq(purchaseOrder.id, input.purchaseOrderId),
    ))
    .for('update');

  if (!order) throw new InvalidPurchaseOrderStateError(`Purchase order ${input.purchaseOrderId} not found`);
  if (order.status !== 'received') {
    throw new InvalidPurchaseOrderStateError(
      `Purchase order ${input.purchaseOrderId} is '${order.status}', not 'received' — cannot post an invoice before goods receipt`,
    ); // → ROLLBACK
  }
  const [existingInvoice] = await exec
    .select({ id: supplierInvoice.id })
    .from(supplierInvoice)
    .where(and(
      eq(supplierInvoice.masterFn, scope.masterFn),
      eq(supplierInvoice.companyFn, scope.companyFn),
      eq(supplierInvoice.orderId, order.id),
    ));
  if (existingInvoice) {
    throw new InvalidPurchaseOrderStateError(
      `Purchase order ${input.purchaseOrderId} already has a supplier invoice`,
    );
  }

  const net = Number(order.netAmount);
  const tax = Number(order.taxAmount);
  const total = Number(order.totalAmount);

  const [inv] = await exec.insert(supplierInvoice).values({
    masterFn: scope.masterFn, companyFn: scope.companyFn,
    docNo: input.docNo, orderId: order.id, supplierId: order.supplierId, projectId: order.projectId,
    status: 'unpaid', invoiceDate: input.invoiceDate, currency: order.currency,
    netAmount: money(net), taxAmount: money(tax), totalAmount: money(total),
  }).returning({ id: supplierInvoice.id });

  // Dr Inventory, Dr Input Tax (recoverable), Cr Accounts Payable.
  const invId = await accountIdByCode(exec, scope, '1400');   // Inventory
  const inputTaxId = await accountIdByCode(exec, scope, '1200'); // GST/SST Input Tax
  const apId = await accountIdByCode(exec, scope, '2100');    // Accounts Payable
  await exec.insert(glEntry).values([
    { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: input.docNo, accountId: invId, debit: money(net), credit: '0', memo: 'Inventory' },
    { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: input.docNo, accountId: inputTaxId, debit: money(tax), credit: '0', memo: 'Input tax' },
    { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: input.docNo, accountId: apId, debit: '0', credit: money(total), memo: 'AP' },
  ]);

  return { invoiceId: inv.id, invDocNo: input.docNo, net, tax, total };
}

export async function postSupplierInvoice(db: DB, scope: Scope, input: PostSupplierInvoiceInput) {
  return db.transaction((tx) => postSupplierInvoiceWithin(tx, scope, input));
}
