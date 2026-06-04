// Demo seed: one master (M1) with a Singapore (GST) and a Malaysia (SST) company,
// currencies, a few products, and effective-dated tax rules (incl. the SG GST 8%→9%
// change so the dated lookup is demonstrable). Same code runs on both adapters.
import { sql } from 'drizzle-orm';
import type { DB } from './db';
import { master, company, currency, appUser, product, taxRule } from './schema';

export async function seedDemo(db: DB): Promise<void> {
  await db.insert(master).values({ masterFn: 'M1', name: 'Acme Group' });

  await db.insert(currency).values([
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  ]);

  await db.insert(company).values([
    { companyFn: 'C-SG', masterFn: 'M1', name: 'Acme Singapore', country: 'SG', currency: 'SGD', taxRegime: 'GST', locale: 'en' },
    { companyFn: 'C-MY', masterFn: 'M1', name: 'Acme Malaysia', country: 'MY', currency: 'MYR', taxRegime: 'SST', locale: 'ms' },
  ]);

  await db.insert(appUser).values({ masterFn: 'M1', email: 'admin@acme.co', fullName: 'Admin', language: 'zh' });

  await db.insert(product).values([
    { masterFn: 'M1', companyFn: 'C-SG', sku: 'SG-WIDGET', name: 'Widget (SG)', uom: 'unit' },
    { masterFn: 'M1', companyFn: 'C-SG', sku: 'SG-GADGET', name: 'Gadget (SG)', uom: 'box' },
    { masterFn: 'M1', companyFn: 'C-MY', sku: 'MY-WIDGET', name: 'Widget (MY)', uom: 'unit' },
  ]);

  // SG GST standard-rated: 8% from 2023, 9% from 2024 (effective-dated).
  await db.insert(taxRule).values([
    { masterFn: 'M1', companyFn: 'C-SG', taxRegime: 'GST', taxCode: 'SR', rate: '8.000', validFrom: '2023-01-01', validTo: '2024-01-01' },
    { masterFn: 'M1', companyFn: 'C-SG', taxRegime: 'GST', taxCode: 'SR', rate: '9.000', validFrom: '2024-01-01', validTo: null },
    // MY SST service tax 8%.
    { masterFn: 'M1', companyFn: 'C-MY', taxRegime: 'SST', taxCode: 'SV', rate: '8.000', validFrom: '2025-07-01', validTo: null },
  ]);
}

/** True if the demo master already exists (so we can avoid double-seeding). */
export async function isSeeded(db: DB): Promise<boolean> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(master);
  return (rows[0]?.n ?? 0) > 0;
}
