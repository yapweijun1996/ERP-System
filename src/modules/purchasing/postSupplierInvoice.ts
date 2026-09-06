// Purchasing — post a supplier invoice: balanced double-entry GL (Dr Inventory,
// Dr Input Tax [recoverable], Cr Accounts Payable), mirroring confirmOrder.ts's
// GL-posting discipline. Requires the PO to already be 'received' — posting AP for
// goods that were never received would be a real accounting error, not just a
// demo shortcut — so this doubles as this module's second rollback-guard scenario
// alongside receiveGoods.ts's double-receipt guard. See docs/DATA_MODEL.md §4.
import { and, eq } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  account, company, glEntry, purchaseOrder, purchaseOrderLine, supplierInvoice,
} from '../../data/schema';
import { InvalidPurchaseOrderStateError, PostingError } from './errors';
import { resolveTaxPostingProfile } from '../localization/tax';

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

  const [companyRow] = await exec.select({ taxRegime: company.taxRegime }).from(company).where(and(
    eq(company.masterFn, scope.masterFn),
    eq(company.companyFn, scope.companyFn),
  )).limit(1);
  const lines = await exec.select({
    taxAmount: purchaseOrderLine.taxAmount,
    taxClassification: purchaseOrderLine.taxClassification,
    inputTaxRecoverablePct: purchaseOrderLine.inputTaxRecoverablePct,
  }).from(purchaseOrderLine).where(and(
    eq(purchaseOrderLine.masterFn, scope.masterFn),
    eq(purchaseOrderLine.companyFn, scope.companyFn),
    eq(purchaseOrderLine.orderId, order.id),
  )).orderBy(purchaseOrderLine.lineNo);
  if (!lines.length) throw new PostingError('Purchase order has no tax-snapshot lines');
  let recoverableTax = new Decimal(0);
  let nonRecoverableTax = new Decimal(0);
  for (const line of lines) {
    const profile = resolveTaxPostingProfile({
      taxRegime: companyRow?.taxRegime ?? (line.taxClassification?.startsWith('gst_') ? 'GST' : 'SST'),
      taxClassification: line.taxClassification,
      inputTaxRecoverablePct: line.inputTaxRecoverablePct,
    }, line.taxAmount);
    if (!profile || (companyRow && profile.taxRegime !== companyRow.taxRegime)) {
      throw new PostingError('Purchase order tax classification is not governed for this Company');
    }
    recoverableTax = recoverableTax.plus(profile.recoverableInputTax);
    nonRecoverableTax = nonRecoverableTax.plus(profile.nonRecoverableTax);
  }

  const netDecimal = new Decimal(order.netAmount);
  const taxDecimal = new Decimal(order.taxAmount);
  const totalDecimal = new Decimal(order.totalAmount);
  if (!netDecimal.plus(taxDecimal).eq(totalDecimal)
    || !recoverableTax.plus(nonRecoverableTax).eq(taxDecimal)) {
    throw new PostingError('Purchase order tax snapshots do not reconcile with the header totals');
  }
  const net = netDecimal.toNumber();
  const tax = taxDecimal.toNumber();
  const total = totalDecimal.toNumber();

  const [inv] = await exec.insert(supplierInvoice).values({
    masterFn: scope.masterFn, companyFn: scope.companyFn,
    docNo: input.docNo, orderId: order.id, supplierId: order.supplierId, projectId: order.projectId,
    status: 'unpaid', invoiceDate: input.invoiceDate, currency: order.currency,
    netAmount: money(net), taxAmount: money(tax), totalAmount: money(total),
  }).returning({ id: supplierInvoice.id });

  // GST recoverable tax is separated; non-recoverable SST (and any governed
  // non-recoverable GST portion) is capitalized into inventory instead of
  // being misclassified as recoverable Input Tax.
  const invId = await accountIdByCode(exec, scope, '1400');
  const apId = await accountIdByCode(exec, scope, '2100');    // Accounts Payable
  const legs = [
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: input.docNo,
      accountId: invId, debit: money(netDecimal.plus(nonRecoverableTax).toNumber()), credit: '0',
      memo: nonRecoverableTax.gt(0) ? 'Inventory including non-recoverable tax' : 'Inventory',
    },
  ];
  if (recoverableTax.gt(0)) {
    const inputTaxId = await accountIdByCode(exec, scope, '1200');
    legs.push({
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: input.docNo,
      accountId: inputTaxId, debit: money(recoverableTax.toNumber()), credit: '0', memo: 'Recoverable input tax',
    });
  }
  legs.push({
    masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: input.docNo,
    accountId: apId, debit: '0', credit: money(total), memo: 'AP',
  });
  await exec.insert(glEntry).values(legs);

  return { invoiceId: inv.id, invDocNo: input.docNo, net, tax, total };
}

export async function postSupplierInvoice(db: DB, scope: Scope, input: PostSupplierInvoiceInput) {
  return db.transaction((tx) => postSupplierInvoiceWithin(tx, scope, input));
}
