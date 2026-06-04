// Dual-adapter proof: the SAME seed + repo code runs on PGlite AND PostgreSQL and
// produces identical results.
//   - PGlite always runs (in-process, no server).
//   - PostgreSQL runs when POSTGRES_URL is set.
// Run: npm run demo   (or: POSTGRES_URL=postgres://… npm run demo)
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { createPgliteDb, createPostgresDb, type DB } from './data/db';
import { seedDemo } from './data/seed';
import { listCompanies, listProducts, addProduct, getEffectiveTaxRate } from './data/repo';

/** The exact same business scenario, adapter-agnostic. */
async function runScenario(db: DB) {
  await seedDemo(db);
  const scope = { masterFn: 'M1', companyFn: 'C-SG' };

  const companies = await listCompanies(db, 'M1');                      // read
  const added = await addProduct(db, scope, 'SG-NEW', 'New SG Product'); // write
  const products = await listProducts(db, scope);                       // read-after-write
  const gst2023 = await getEffectiveTaxRate(db, scope, 'SR', '2023-06-01'); // dated → 8.000
  const gst2024 = await getEffectiveTaxRate(db, scope, 'SR', '2024-06-01'); // dated → 9.000

  return {
    companies: companies.map((c) => `${c.companyFn}:${c.taxRegime}`),
    addedSku: added.sku,
    productCount: products.length,
    gstRate_2023: gst2023?.rate,
    gstRate_2024: gst2024?.rate,
  };
}

const out: Record<string, unknown> = {};

// --- PGlite (demo engine) ---
{
  const db = await createPgliteDb();                            // in-memory
  await migratePglite(db, { migrationsFolder: 'drizzle' });
  out.pglite = await runScenario(db);
}

// --- PostgreSQL (production engine) ---
const url = process.env.POSTGRES_URL;
if (url) {
  const db = await createPostgresDb(url);
  await migratePg(db, { migrationsFolder: 'drizzle' });
  out.postgres = await runScenario(db);
}

console.log(JSON.stringify(out, null, 2));

if (out.postgres) {
  const same = JSON.stringify(out.pglite) === JSON.stringify(out.postgres);
  console.log(same
    ? 'IDENTICAL ACROSS BOTH ADAPTERS ✅  (same repo code, two engines)'
    : 'MISMATCH ❌');
  process.exit(same ? 0 : 1);
} else {
  console.log('PGlite ran. Set POSTGRES_URL to also verify PostgreSQL.');
  process.exit(0);
}
