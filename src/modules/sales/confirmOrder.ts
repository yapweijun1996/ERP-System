// Sales — confirm order: the full cross-module flow in ONE transaction.
//   sales_order + lines → issue stock per line → invoice → balanced gl_entry.
// Any failure (e.g. a line with insufficient stock) rolls the ENTIRE chain back: no order,
// no lines, no stock movements, no invoice, no ledger postings. See docs/DATA_MODEL.md §4.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { getEffectiveTaxRate } from '../../data/repo';
import { issueStockWithin } from '../inventory/stock';
import { account, glEntry, invoice, salesOrder, salesOrderLine } from '../../data/schema';

export interface OrderLineInput {
  productId: number;
  warehouseId: number;
  qty: number;
  unitPrice: number;
  taxCode: string;
}
export interface ConfirmOrderInput {
  docNo: string;
  customerId: number;
  orderDate: string; // YYYY-MM-DD
  currency: string;
  lines: OrderLineInput[];
}

export class PostingError extends Error {
  constructor(message: string) { super(message); this.name = 'PostingError'; }
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

/**
 * Confirm a sales order. Returns a summary. Throws (and rolls back everything) on any
 * failure — most importantly InsufficientStockError from a line that can't be fulfilled.
 */
export async function confirmSalesOrder(db: DB, scope: Scope, input: ConfirmOrderInput) {
  return db.transaction(async (tx) => {
    // 1. Header (totals filled in after lines).
    const [order] = await tx.insert(salesOrder).values({
      masterFn: scope.masterFn, companyFn: scope.companyFn,
      docNo: input.docNo, customerId: input.customerId,
      status: 'confirmed', orderDate: input.orderDate, currency: input.currency,
    }).returning({ id: salesOrder.id });

    let netTotal = 0;
    let taxTotal = 0;
    const movementIds: number[] = [];

    // 2. Lines: snapshot tax, deduct stock (may throw → full rollback), accumulate totals.
    let lineNo = 0;
    for (const ln of input.lines) {
      lineNo += 1;
      const taxRow = await getEffectiveTaxRate(tx, scope, ln.taxCode, input.orderDate);
      if (!taxRow) throw new PostingError(`No tax rule for ${ln.taxCode} on ${input.orderDate}`);
      const rate = Number(taxRow.rate);
      const net = Math.round(ln.qty * ln.unitPrice * 100) / 100;
      const tax = Math.round(net * rate) / 100;

      await tx.insert(salesOrderLine).values({
        masterFn: scope.masterFn, companyFn: scope.companyFn,
        orderId: order.id, lineNo,
        productId: ln.productId, qty: String(ln.qty), unitPrice: String(ln.unitPrice),
        netAmount: money(net), taxCode: ln.taxCode, taxRate: String(rate), taxAmount: money(tax),
      });

      const issue = await issueStockWithin(tx, scope, {
        productId: ln.productId, warehouseId: ln.warehouseId, qty: ln.qty,
        refType: 'sales_order', refId: order.id,
      });
      movementIds.push(issue.movementId);

      netTotal += net;
      taxTotal += tax;
    }
    const grandTotal = Math.round((netTotal + taxTotal) * 100) / 100;

    // 3. Finalize header totals.
    await tx.update(salesOrder).set({
      netAmount: money(netTotal), taxAmount: money(taxTotal), totalAmount: money(grandTotal),
      updatedAt: sql`now()`,
    }).where(eq(salesOrder.id, order.id));

    // 4. Invoice.
    const invDocNo = `INV-${input.docNo}`;
    const [inv] = await tx.insert(invoice).values({
      masterFn: scope.masterFn, companyFn: scope.companyFn,
      docNo: invDocNo, orderId: order.id, customerId: input.customerId,
      status: 'unpaid', invoiceDate: input.orderDate, currency: input.currency,
      netAmount: money(netTotal), taxAmount: money(taxTotal), totalAmount: money(grandTotal),
    }).returning({ id: invoice.id });

    // 5. Post balanced double-entry ledger: Dr AR, Cr Revenue, Cr GST Output.
    const arId = await accountIdByCode(tx, scope, '1100');       // Accounts Receivable
    const revId = await accountIdByCode(tx, scope, '4000');      // Revenue
    const taxId = await accountIdByCode(tx, scope, '2200');      // GST/SST Output
    await tx.insert(glEntry).values([
      { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: invDocNo, accountId: arId, debit: money(grandTotal), credit: '0', memo: 'AR' },
      { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: invDocNo, accountId: revId, debit: '0', credit: money(netTotal), memo: 'Revenue' },
      { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: invDocNo, accountId: taxId, debit: '0', credit: money(taxTotal), memo: 'Output tax' },
    ]);

    return {
      orderId: order.id, invoiceId: inv.id, invDocNo,
      net: netTotal, tax: taxTotal, total: grandTotal,
      lines: input.lines.length, movementIds,
    };
  });
}
