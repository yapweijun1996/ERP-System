// Dual-adapter proof + cross-module transaction proof.
//   - PGlite always runs (in-process). Atomicity + rollback are proven here.
//   - PostgreSQL runs when POSTGRES_URL is set. TRUE concurrency (FOR UPDATE preventing
//     over-sell) is proven only here — PGlite is single-connection (single-user), so a
//     real two-transaction race cannot exist in the demo/browser anyway.
// Run: npm run demo   (or: POSTGRES_URL=postgres://… npm run demo)
import { and, eq } from 'drizzle-orm';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { createPgliteDb, createPostgresDb, type DB } from './data/db';
import { seedDemo } from './data/seed';
import { listCompanies, listProducts, addProduct, getEffectiveTaxRate, type Scope } from './data/repo';
import { product, warehouse, stockLevel } from './data/schema';
import {
  issueStock, getStockQty, countMovements, setStockQty, InsufficientStockError,
} from './modules/inventory/stock';

const SCOPE: Scope = { masterFn: 'M1', companyFn: 'C-SG' };

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

async function runEngine(db: DB, withConcurrency: boolean) {
  await seedDemo(db);
  const repo = await runRepoScenario(db);
  const fx = await setupStockFixture(db);
  const tx = await runTxScenario(db, fx);
  const concurrency = withConcurrency ? await runConcurrencyTest(db, fx) : null;
  return { repo, tx, concurrency };
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
ok = check('PGlite: issue 8 → remaining 2', out.pglite.tx.issued8_remaining === 2) && ok;
ok = check('PGlite: rollback on insufficient (stock stays 2, movements stay 1)',
  out.pglite.tx.rolledBack && out.pglite.tx.stockAfterB_unchanged === 2 && out.pglite.tx.movementsAfterB_unchanged === 1) && ok;

if (out.postgres) {
  const sameRepo = JSON.stringify(out.pglite.repo) === JSON.stringify(out.postgres.repo);
  const sameTx = JSON.stringify(out.pglite.tx) === JSON.stringify(out.postgres.tx);
  ok = check('repo+tx identical across PGlite and PostgreSQL', sameRepo && sameTx) && ok;
  const c = out.postgres.concurrency!;
  ok = check('Postgres concurrency: exactly 1 of 2 races wins (no over-sell)',
    c.fulfilled === 1 && c.rejected === 1 && c.finalStock === 2 && c.movementsDelta === 1) && ok;
} else {
  console.log('ℹ️  Set POSTGRES_URL to also prove cross-engine equality + true concurrency.');
}

console.log(ok ? '\nALL CHECKS PASSED ✅' : '\nSOME CHECKS FAILED ❌');
process.exit(ok ? 0 : 1);
