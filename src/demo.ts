// Dual-adapter proof + cross-module transaction proof.
//   - PGlite always runs (in-process). Atomicity + rollback are proven here.
//   - PostgreSQL runs when POSTGRES_URL is set. TRUE concurrency (FOR UPDATE preventing
//     over-sell) is proven only here — PGlite is single-connection (single-user), so a
//     real two-transaction race cannot exist in the demo/browser anyway.
// Run: npm run demo   (or: POSTGRES_URL=postgres://… npm run demo)
import { and, eq, sql } from 'drizzle-orm';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { createPgliteDb, createPostgresDb, type DB } from './data/db';
import { seedDemo } from './data/seed';
import { listCompanies, listProducts, addProduct, getEffectiveTaxRate, type Scope } from './data/repo';
import {
  product, warehouse, stockLevel, customer, salesOrder, invoice, glEntry,
  supplier, supplierInvoice, opportunity,
} from './data/schema';
import {
  issueStock, getStockQty, countMovements, setStockQty, InsufficientStockError,
} from './modules/inventory/stock';
import { confirmSalesOrder } from './modules/sales/confirmOrder';
import { createPurchaseOrder } from './modules/purchasing/createPurchaseOrder';
import { receiveGoods } from './modules/purchasing/receiveGoods';
import { postSupplierInvoice } from './modules/purchasing/postSupplierInvoice';
import { createOpportunity } from './modules/crm/createOpportunity';
import { convertOpportunityToSalesOrder } from './modules/crm/convertOpportunityToSalesOrder';

const SCOPE: Scope = { masterFn: 'M1', companyFn: 'C-SG' };

// --- small count/lookup helpers for the sales scenario ---
async function getProductId(db: DB, sku: string): Promise<number> {
  const [p] = await db.select({ id: product.id }).from(product)
    .where(and(eq(product.masterFn, SCOPE.masterFn), eq(product.companyFn, SCOPE.companyFn), eq(product.sku, sku)));
  return p.id;
}
async function countOrders(db: DB): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(salesOrder)
    .where(and(eq(salesOrder.masterFn, SCOPE.masterFn), eq(salesOrder.companyFn, SCOPE.companyFn)));
  return r.n;
}
async function countInvoices(db: DB): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(invoice)
    .where(and(eq(invoice.masterFn, SCOPE.masterFn), eq(invoice.companyFn, SCOPE.companyFn)));
  return r.n;
}
async function glBalance(db: DB, journalRef: string) {
  const [r] = await db.select({
    debit: sql<number>`coalesce(sum(debit),0)::float`,
    credit: sql<number>`coalesce(sum(credit),0)::float`,
  }).from(glEntry)
    .where(and(eq(glEntry.masterFn, SCOPE.masterFn), eq(glEntry.companyFn, SCOPE.companyFn), eq(glEntry.journalRef, journalRef)));
  return { debit: r.debit, credit: r.credit };
}

/** Repo read/write/dated-tax scenario (unchanged). */
async function runRepoScenario(db: DB) {
  const companies = await listCompanies(db, 'M1');
  const added = await addProduct(db, SCOPE, 'SG-NEW', 'New SG Product');
  const products = await listProducts(db, SCOPE);
  const gst2023 = await getEffectiveTaxRate(db, SCOPE, 'SR', '2023-06-01');
  const gst2024 = await getEffectiveTaxRate(db, SCOPE, 'SR', '2024-06-01');
  return {
    companies: companies.map((c) => `${c.companyFn}:${c.taxRegime}`),
    addedSku: added.sku,
    productCount: products.length,
    gstRate_2023: gst2023?.rate,
    gstRate_2024: gst2024?.rate,
  };
}

/** Create a warehouse + stock_level(qty=10) for SG-WIDGET; return the ids. */
async function setupStockFixture(db: DB) {
  const [wh] = await db.insert(warehouse)
    .values({ masterFn: 'M1', companyFn: 'C-SG', code: 'WH1', name: 'Main Warehouse' })
    .returning({ id: warehouse.id });
  const [prod] = await db.select({ id: product.id }).from(product)
    .where(and(eq(product.masterFn, 'M1'), eq(product.companyFn, 'C-SG'), eq(product.sku, 'SG-WIDGET')));
  await db.insert(stockLevel)
    .values({ masterFn: 'M1', companyFn: 'C-SG', productId: prod.id, warehouseId: wh.id, qty: '10' });
  return { productId: prod.id, warehouseId: wh.id };
}

/** Atomicity + rollback (both engines). Start stock = 10. */
async function runTxScenario(db: DB, fx: { productId: number; warehouseId: number }) {
  // Test A — happy path: issue 8 of 10 → remaining 2, exactly 1 movement.
  const a = await issueStock(db, SCOPE, { ...fx, qty: 8, refType: 'sales_order', refId: 1 });
  const stockAfterA = await getStockQty(db, SCOPE, fx.productId, fx.warehouseId);
  const movementsAfterA = await countMovements(db, SCOPE, fx.productId, fx.warehouseId);

  // Test B — rollback: issue 100 of 2 → throws, NOTHING changes (no partial deduct/movement).
  let rolledBack = false; let errName = '';
  try {
    await issueStock(db, SCOPE, { ...fx, qty: 100, refType: 'sales_order', refId: 2 });
  } catch (e) {
    rolledBack = true;
    errName = e instanceof InsufficientStockError ? e.name : `Unexpected:${(e as Error).name}`;
  }
  const stockAfterB = await getStockQty(db, SCOPE, fx.productId, fx.warehouseId);
  const movementsAfterB = await countMovements(db, SCOPE, fx.productId, fx.warehouseId);

  return {
    issued8_remaining: a.remaining,
    stockAfterA, movementsAfterA,
    rolledBack, errName,
    stockAfterB_unchanged: stockAfterB,      // expect 2
    movementsAfterB_unchanged: movementsAfterB, // expect 1
  };
}

/** TRUE concurrency (PostgreSQL only): two simultaneous issues of 8 from stock 10. */
async function runConcurrencyTest(db: DB, fx: { productId: number; warehouseId: number }) {
  await setStockQty(db, SCOPE, fx.productId, fx.warehouseId, 10); // reset to 10
  const before = await countMovements(db, SCOPE, fx.productId, fx.warehouseId);
  const results = await Promise.allSettled([
    issueStock(db, SCOPE, { ...fx, qty: 8, refType: 'race', refId: 1 }),
    issueStock(db, SCOPE, { ...fx, qty: 8, refType: 'race', refId: 2 }),
  ]);
  const after = await countMovements(db, SCOPE, fx.productId, fx.warehouseId);
  return {
    fulfilled: results.filter((r) => r.status === 'fulfilled').length, // expect 1
    rejected: results.filter((r) => r.status === 'rejected').length,   // expect 1
    finalStock: await getStockQty(db, SCOPE, fx.productId, fx.warehouseId), // expect 2 (not -6)
    movementsDelta: after - before, // expect 1 (only the winner wrote a movement)
  };
}

/** Full chain (both engines): confirm order → issue stock → invoice → balanced GL, with
 *  whole-chain rollback when a later line fails (and an EARLIER valid line is undone too). */
async function runSalesScenario(db: DB) {
  const widgetId = await getProductId(db, 'SG-WIDGET');
  const gadgetId = await getProductId(db, 'SG-GADGET');
  const [wh] = await db.insert(warehouse)
    .values({ masterFn: 'M1', companyFn: 'C-SG', code: 'WH-SALES', name: 'Sales Warehouse' })
    .returning({ id: warehouse.id });
  await db.insert(stockLevel).values([
    { masterFn: 'M1', companyFn: 'C-SG', productId: widgetId, warehouseId: wh.id, qty: '100' },
    { masterFn: 'M1', companyFn: 'C-SG', productId: gadgetId, warehouseId: wh.id, qty: '100' },
  ]);
  const [cust] = await db.select({ id: customer.id }).from(customer)
    .where(and(eq(customer.masterFn, 'M1'), eq(customer.companyFn, 'C-SG'), eq(customer.code, 'CUST1')));

  // Valid order: 2 lines @ 9% GST (2024). net = 5*10 + 3*20 = 110; tax = 9.90; total 119.90.
  const res = await confirmSalesOrder(db, SCOPE, {
    docNo: 'SO-1', customerId: cust.id, orderDate: '2024-06-01', currency: 'SGD',
    lines: [
      { productId: widgetId, warehouseId: wh.id, qty: 5, unitPrice: 10, taxCode: 'SR' },
      { productId: gadgetId, warehouseId: wh.id, qty: 3, unitPrice: 20, taxCode: 'SR' },
    ],
  });
  const gl = await glBalance(db, res.invDocNo);
  const widgetAfter = await getStockQty(db, SCOPE, widgetId, wh.id); // 95
  const gadgetAfter = await getStockQty(db, SCOPE, gadgetId, wh.id); // 97
  const ordersAfterValid = await countOrders(db);                    // 1

  // Rollback order: line 1 (widget) is valid, line 2 (gadget) exceeds stock → whole order
  // rolls back, INCLUDING line 1's stock deduction. Nothing persists.
  let rollbackErr = '';
  try {
    await confirmSalesOrder(db, SCOPE, {
      docNo: 'SO-2', customerId: cust.id, orderDate: '2024-06-01', currency: 'SGD',
      lines: [
        { productId: widgetId, warehouseId: wh.id, qty: 5, unitPrice: 10, taxCode: 'SR' },   // ok alone
        { productId: gadgetId, warehouseId: wh.id, qty: 99999, unitPrice: 20, taxCode: 'SR' }, // fails
      ],
    });
  } catch (e) {
    rollbackErr = (e as Error).name;
  }

  return {
    order: { net: res.net, tax: res.tax, total: res.total, lines: res.lines, movements: res.movementIds.length },
    glDebit: gl.debit, glCredit: gl.credit, glBalanced: gl.debit === gl.credit,
    widgetAfter, gadgetAfter, ordersAfterValid,
    rollbackErr,                                                    // 'InsufficientStockError'
    ordersAfterRollback: await countOrders(db),                    // still 1
    invoicesAfterRollback: await countInvoices(db),                // still 1
    widgetAfterRollback: await getStockQty(db, SCOPE, widgetId, wh.id), // still 95 (line-1 undone)
    gadgetMovements: await countMovements(db, SCOPE, gadgetId, wh.id),  // 1 (only the valid order)
  };
}

/** Full purchasing chain (both engines): create PO → receive goods (stock IN,
 *  from zero) → post supplier invoice (balanced GL), then three independent
 *  rollback proofs mirroring confirmOrder.ts's discipline for the purchasing
 *  side: receiving an already-received PO, invoicing it twice, and invoicing
 *  a not-yet-received one. */
async function runPurchasingScenario(db: DB) {
  const widgetId = await getProductId(db, 'SG-WIDGET');
  const [wh] = await db.insert(warehouse)
    .values({ masterFn: 'M1', companyFn: 'C-SG', code: 'WH-PUR', name: 'Purchasing Warehouse' })
    .returning({ id: warehouse.id });
  const [supp] = await db.select({ id: supplier.id }).from(supplier)
    .where(and(eq(supplier.masterFn, 'M1'), eq(supplier.companyFn, 'C-SG'), eq(supplier.code, 'SUPP1')));

  // Valid PO: 20 widgets @ cost 6, 9% GST (2024). net = 120; tax = 10.80; total 130.80.
  const po = await createPurchaseOrder(db, SCOPE, {
    docNo: 'PO-1', supplierId: supp.id, orderDate: '2024-06-01', currency: 'SGD',
    lines: [{ productId: widgetId, qty: 20, unitCost: 6, taxCode: 'SR' }],
  });
  const stockBeforeReceipt = await getStockQty(db, SCOPE, widgetId, wh.id); // 0 — no prior stock in this warehouse

  const receipt = await receiveGoods(db, SCOPE, {
    purchaseOrderId: po.orderId, warehouseId: wh.id, docNo: 'GR-1', receivedDate: '2024-06-05',
  });
  const stockAfterReceipt = await getStockQty(db, SCOPE, widgetId, wh.id); // 20
  const movementsAfterReceipt = await countMovements(db, SCOPE, widgetId, wh.id); // 1

  const inv = await postSupplierInvoice(db, SCOPE, {
    purchaseOrderId: po.orderId, docNo: 'SINV-1', invoiceDate: '2024-06-06',
  });
  const gl = await glBalance(db, inv.invDocNo);

  // Rollback A: receiving the SAME PO twice must fail and change nothing.
  let doubleReceiveErr = '';
  try {
    await receiveGoods(db, SCOPE, {
      purchaseOrderId: po.orderId, warehouseId: wh.id, docNo: 'GR-2', receivedDate: '2024-06-06',
    });
  } catch (e) {
    doubleReceiveErr = (e as Error).name;
  }
  const stockAfterDoubleReceiveAttempt = await getStockQty(db, SCOPE, widgetId, wh.id); // still 20, not 40

  // Rollback B: a PO can create only one supplier invoice / GL posting.
  let duplicateInvoiceErr = '';
  try {
    await postSupplierInvoice(db, SCOPE, {
      purchaseOrderId: po.orderId, docNo: 'SINV-1-DUP', invoiceDate: '2024-06-06',
    });
  } catch (e) {
    duplicateInvoiceErr = (e as Error).name;
  }
  const duplicateInvoiceGl = await glBalance(db, 'SINV-1-DUP'); // 0/0 — nothing posted

  // Rollback C: invoicing a PO that hasn't been received yet must fail and post no GL legs.
  const po2 = await createPurchaseOrder(db, SCOPE, {
    docNo: 'PO-2', supplierId: supp.id, orderDate: '2024-06-01', currency: 'SGD',
    lines: [{ productId: widgetId, qty: 5, unitCost: 6, taxCode: 'SR' }],
  });
  let earlyInvoiceErr = '';
  try {
    await postSupplierInvoice(db, SCOPE, { purchaseOrderId: po2.orderId, docNo: 'SINV-2', invoiceDate: '2024-06-06' });
  } catch (e) {
    earlyInvoiceErr = (e as Error).name;
  }
  const earlyInvoiceGl = await glBalance(db, 'SINV-2'); // 0/0 — nothing posted

  // Concurrency proof: two independent requests race to invoice one received PO.
  const po3 = await createPurchaseOrder(db, SCOPE, {
    docNo: 'PO-3', supplierId: supp.id, orderDate: '2024-06-01', currency: 'SGD',
    lines: [{ productId: widgetId, qty: 3, unitCost: 6, taxCode: 'SR' }],
  });
  await receiveGoods(db, SCOPE, {
    purchaseOrderId: po3.orderId, warehouseId: wh.id, docNo: 'GR-3', receivedDate: '2024-06-05',
  });
  const invoiceRace = await Promise.allSettled([
    postSupplierInvoice(db, SCOPE, {
      purchaseOrderId: po3.orderId, docNo: 'SINV-3-A', invoiceDate: '2024-06-06',
    }),
    postSupplierInvoice(db, SCOPE, {
      purchaseOrderId: po3.orderId, docNo: 'SINV-3-B', invoiceDate: '2024-06-06',
    }),
  ]);
  const [invoiceRaceCount] = await db.select({ n: sql<number>`count(*)::int` })
    .from(supplierInvoice)
    .where(and(
      eq(supplierInvoice.masterFn, SCOPE.masterFn),
      eq(supplierInvoice.companyFn, SCOPE.companyFn),
      eq(supplierInvoice.orderId, po3.orderId),
    ));

  return {
    po: { net: po.net, tax: po.tax, total: po.total },
    stockBeforeReceipt, stockAfterReceipt, movementsAfterReceipt,
    receiptLines: receipt.lines,
    invoice: { net: inv.net, tax: inv.tax, total: inv.total },
    glDebit: gl.debit, glCredit: gl.credit, glBalanced: gl.debit === gl.credit,
    doubleReceiveErr,                                    // 'InvalidPurchaseOrderStateError'
    stockAfterDoubleReceiveAttempt,                       // still 20
    duplicateInvoiceErr,                                  // 'InvalidPurchaseOrderStateError'
    duplicateInvoiceGlDebit: duplicateInvoiceGl.debit,
    duplicateInvoiceGlCredit: duplicateInvoiceGl.credit,  // 0, 0
    earlyInvoiceErr,                                      // 'InvalidPurchaseOrderStateError'
    earlyInvoiceGlDebit: earlyInvoiceGl.debit, earlyInvoiceGlCredit: earlyInvoiceGl.credit, // 0, 0
    invoiceRaceFulfilled: invoiceRace.filter((result) => result.status === 'fulfilled').length,
    invoiceRaceRejected: invoiceRace.filter((result) => result.status === 'rejected').length,
    invoiceRaceCount: invoiceRaceCount.n,
  };
}

/** Full CRM chain (both engines): create opportunity → convert to sales order (stock
 *  issue + invoice + balanced GL, composed atomically with the opportunity's own
 *  stage update via confirmSalesOrderWithin) → two independent rollback proofs:
 *  converting the same opportunity twice, and a failure INSIDE the composed
 *  transaction leaving the opportunity genuinely untouched (not half-converted) —
 *  the whole reason confirmSalesOrder was split into a composable core. */
async function runCrmScenario(db: DB) {
  const widgetId = await getProductId(db, 'SG-WIDGET');
  const [wh] = await db.insert(warehouse)
    .values({ masterFn: 'M1', companyFn: 'C-SG', code: 'WH-CRM', name: 'CRM Warehouse' })
    .returning({ id: warehouse.id });
  await db.insert(stockLevel)
    .values({ masterFn: 'M1', companyFn: 'C-SG', productId: widgetId, warehouseId: wh.id, qty: '50' });
  const [cust] = await db.select({ id: customer.id }).from(customer)
    .where(and(eq(customer.masterFn, 'M1'), eq(customer.companyFn, 'C-SG'), eq(customer.code, 'CUST1')));

  // Valid conversion: 5 widgets @ 10, 9% GST (2024). net = 50; tax = 4.50; total 54.50.
  const opp = await createOpportunity(db, SCOPE, {
    docNo: 'OPP-2', customerId: cust.id, title: 'Widget resupply deal',
    value: 65, currency: 'SGD', closeDate: '2024-06-10',
  });
  const conv = await convertOpportunityToSalesOrder(db, SCOPE, {
    opportunityId: opp.opportunityId, docNo: 'SO-CRM-1', orderDate: '2024-06-01',
    lines: [{ productId: widgetId, warehouseId: wh.id, qty: 5, unitPrice: 10, taxCode: 'SR' }],
  });
  const gl = await glBalance(db, conv.invDocNo);
  const stockAfter = await getStockQty(db, SCOPE, widgetId, wh.id); // 45

  // Rollback A: converting the SAME opportunity twice must fail and change nothing.
  let doubleConvertErr = '';
  try {
    await convertOpportunityToSalesOrder(db, SCOPE, {
      opportunityId: opp.opportunityId, docNo: 'SO-CRM-2', orderDate: '2024-06-02',
      lines: [{ productId: widgetId, warehouseId: wh.id, qty: 1, unitPrice: 10, taxCode: 'SR' }],
    });
  } catch (e) {
    doubleConvertErr = (e as Error).name;
  }
  const stockAfterDoubleConvertAttempt = await getStockQty(db, SCOPE, widgetId, wh.id); // still 45, not 44

  // Rollback B: insufficient stock inside the COMPOSED transaction must leave the
  // opportunity untouched (not half-converted) — proves confirmSalesOrderWithin
  // and the opportunity-stage update are genuinely one atomic unit.
  const opp2 = await createOpportunity(db, SCOPE, {
    docNo: 'OPP-3', customerId: cust.id, title: 'Oversized deal',
    value: 999999, currency: 'SGD', closeDate: '2024-06-20',
  });
  let insufficientErr = '';
  try {
    await convertOpportunityToSalesOrder(db, SCOPE, {
      opportunityId: opp2.opportunityId, docNo: 'SO-CRM-3', orderDate: '2024-06-01',
      lines: [{ productId: widgetId, warehouseId: wh.id, qty: 99999, unitPrice: 10, taxCode: 'SR' }],
    });
  } catch (e) {
    insufficientErr = (e as Error).name;
  }
  const [oppRow] = await db.select({ stage: opportunity.stage }).from(opportunity)
    .where(and(eq(opportunity.masterFn, 'M1'), eq(opportunity.companyFn, 'C-SG'), eq(opportunity.id, opp2.opportunityId)));

  return {
    conv: { net: conv.net, tax: conv.tax, total: conv.total },
    glDebit: gl.debit, glCredit: gl.credit, glBalanced: gl.debit === gl.credit,
    stockAfter,
    doubleConvertErr,                          // 'InvalidOpportunityStateError'
    stockAfterDoubleConvertAttempt,             // still 45
    insufficientErr,                            // 'InsufficientStockError'
    oppAfterFailedConvertStage: oppRow.stage,   // still 'lead' — untouched
  };
}

async function runEngine(db: DB, withConcurrency: boolean) {
  await seedDemo(db);
  const repo = await runRepoScenario(db);
  const fx = await setupStockFixture(db);
  const tx = await runTxScenario(db, fx);
  const sales = await runSalesScenario(db);
  const purchasing = await runPurchasingScenario(db);
  const crm = await runCrmScenario(db);
  const concurrency = withConcurrency ? await runConcurrencyTest(db, fx) : null;
  return { repo, tx, sales, purchasing, crm, concurrency };
}

const out: Record<string, Awaited<ReturnType<typeof runEngine>>> = {};

// --- PGlite (demo engine): atomicity + rollback ---
{
  const db = await createPgliteDb();
  await migratePglite(db, { migrationsFolder: 'drizzle' });
  out.pglite = await runEngine(db, /* withConcurrency */ false);
}

// --- PostgreSQL (production engine): + true concurrency ---
const url = process.env.POSTGRES_URL;
if (url) {
  const db = await createPostgresDb(url);
  await migratePg(db, { migrationsFolder: 'drizzle' });
  out.postgres = await runEngine(db, /* withConcurrency */ true);
}

console.log(JSON.stringify(out, null, 2));

// Shared assertions (repo + tx) must match across engines; concurrency is Postgres-only.
function check(label: string, cond: boolean) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  return cond;
}

let ok = true;
const p = out.pglite;
ok = check('PGlite: issue 8 → remaining 2', p.tx.issued8_remaining === 2) && ok;
ok = check('PGlite: rollback on insufficient (stock stays 2, movements stay 1)',
  p.tx.rolledBack && p.tx.stockAfterB_unchanged === 2 && p.tx.movementsAfterB_unchanged === 1) && ok;
ok = check('PGlite sales chain: order net=110 tax=9.9 total=119.9, 2 movements',
  p.sales.order.net === 110 && p.sales.order.tax === 9.9 && p.sales.order.total === 119.9 && p.sales.order.movements === 2) && ok;
ok = check('PGlite sales chain: ledger balanced (Dr 119.9 = Cr 119.9), stock 95/97',
  p.sales.glBalanced && p.sales.glDebit === 119.9 && p.sales.widgetAfter === 95 && p.sales.gadgetAfter === 97) && ok;
ok = check('PGlite sales rollback: whole order undone — incl. valid line 1 (widget stays 95, orders=1, invoices=1)',
  p.sales.rollbackErr === 'InsufficientStockError' && p.sales.ordersAfterRollback === 1
  && p.sales.invoicesAfterRollback === 1 && p.sales.widgetAfterRollback === 95 && p.sales.gadgetMovements === 1) && ok;
ok = check('PGlite purchasing chain: PO net=120 tax=10.8 total=130.8, receipt creates stock from 0 → 20',
  p.purchasing.po.net === 120 && p.purchasing.po.tax === 10.8 && p.purchasing.po.total === 130.8
  && p.purchasing.stockBeforeReceipt === 0 && p.purchasing.stockAfterReceipt === 20 && p.purchasing.movementsAfterReceipt === 1) && ok;
ok = check('PGlite purchasing chain: supplier invoice ledger balanced (Dr 130.8 = Cr 130.8)',
  p.purchasing.glBalanced && p.purchasing.glDebit === 130.8 && p.purchasing.invoice.total === 130.8) && ok;
ok = check('PGlite purchasing rollback: double-receive and duplicate/early invoices are rejected without stock/GL duplication',
  p.purchasing.doubleReceiveErr === 'InvalidPurchaseOrderStateError' && p.purchasing.stockAfterDoubleReceiveAttempt === 20
  && p.purchasing.duplicateInvoiceErr === 'InvalidPurchaseOrderStateError'
  && p.purchasing.duplicateInvoiceGlDebit === 0 && p.purchasing.duplicateInvoiceGlCredit === 0
  && p.purchasing.earlyInvoiceErr === 'InvalidPurchaseOrderStateError'
  && p.purchasing.earlyInvoiceGlDebit === 0 && p.purchasing.earlyInvoiceGlCredit === 0
  && p.purchasing.invoiceRaceFulfilled === 1 && p.purchasing.invoiceRaceRejected === 1
  && p.purchasing.invoiceRaceCount === 1) && ok;
ok = check('PGlite CRM chain: converting an opportunity creates a real order (net=50 tax=4.5 total=54.5), stock 50→45, balanced GL',
  p.crm.conv.net === 50 && p.crm.conv.tax === 4.5 && p.crm.conv.total === 54.5
  && p.crm.stockAfter === 45 && p.crm.glBalanced && p.crm.glDebit === 54.5) && ok;
ok = check('PGlite CRM rollback: double-convert rejected (stock stays 45); insufficient stock leaves the opportunity untouched, not half-converted',
  p.crm.doubleConvertErr === 'InvalidOpportunityStateError' && p.crm.stockAfterDoubleConvertAttempt === 45
  && p.crm.insufficientErr === 'InsufficientStockError' && p.crm.oppAfterFailedConvertStage === 'lead') && ok;

if (out.postgres) {
  const sameRepo = JSON.stringify(out.pglite.repo) === JSON.stringify(out.postgres.repo);
  const sameTx = JSON.stringify(out.pglite.tx) === JSON.stringify(out.postgres.tx);
  const sameSales = JSON.stringify(out.pglite.sales) === JSON.stringify(out.postgres.sales);
  const samePurchasing = JSON.stringify(out.pglite.purchasing) === JSON.stringify(out.postgres.purchasing);
  const sameCrm = JSON.stringify(out.pglite.crm) === JSON.stringify(out.postgres.crm);
  ok = check('repo+tx+sales+purchasing+crm identical across PGlite and PostgreSQL', sameRepo && sameTx && sameSales && samePurchasing && sameCrm) && ok;
  const c = out.postgres.concurrency!;
  ok = check('Postgres concurrency: exactly 1 of 2 races wins (no over-sell)',
    c.fulfilled === 1 && c.rejected === 1 && c.finalStock === 2 && c.movementsDelta === 1) && ok;
} else {
  console.log('ℹ️  Set POSTGRES_URL to also prove cross-engine equality + true concurrency.');
}

console.log(ok ? '\nALL CHECKS PASSED ✅' : '\nSOME CHECKS FAILED ❌');
process.exit(ok ? 0 : 1);
