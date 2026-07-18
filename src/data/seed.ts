// Demo seed: one master (M1) with a Singapore (GST) and a Malaysia (SST) company,
// currencies, a few products, and effective-dated tax rules (incl. the SG GST 8%→9%
// change so the dated lookup is demonstrable). Same code runs on both adapters.
import { sql } from 'drizzle-orm';
import type { DB } from './db';
import {
  master, company, currency, appUser, role, rolePermission, userCompany,
  product, taxRule, customer, account, supplier, opportunity,
} from './schema';

/**
 * Fixed PBKDF2 hashes for the two demo passwords below (see src/auth/password.ts).
 * Pre-computed rather than hashed at seed time so `seedDemo` stays synchronous-shaped
 * and doesn't burn 100k PBKDF2 iterations on every demo boot. Demo passwords are
 * intentionally documented here — this is public sample data, not a real credential.
 *   admin@acme.co  / demo1234
 *   viewer@acme.co / viewer1234
 */
const ADMIN_PASSWORD_HASH = 'pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48';
const VIEWER_PASSWORD_HASH = 'pbkdf2$100000$da9fd51416f6c2fb48c282c0b370bdf1$072cf69c4fb68981cbb43a5af00b11435244a758e0a0ea4b538dd1074fac60a3';

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

  // Two demo personas so "switch user" (TASK-024) is meaningful: a superadmin with
  // access to both companies, and a company-scoped viewer with access to SG only.
  const [adminUser] = await db.insert(appUser).values({
    masterFn: 'M1', email: 'admin@acme.co', fullName: 'Admin', passwordHash: ADMIN_PASSWORD_HASH, language: 'zh',
  }).returning({ id: appUser.userId });
  const [viewerUser] = await db.insert(appUser).values({
    masterFn: 'M1', email: 'viewer@acme.co', fullName: 'Demo Viewer', passwordHash: VIEWER_PASSWORD_HASH, language: 'en',
  }).returning({ id: appUser.userId });

  const [superadminRole] = await db.insert(role).values({
    masterFn: 'M1', name: 'Superadmin', isSuperadmin: true,
  }).returning({ id: role.roleId });
  const [viewerRole] = await db.insert(role).values({
    masterFn: 'M1', name: 'Viewer', isSuperadmin: false,
  }).returning({ id: role.roleId });

  await db.insert(userCompany).values([
    { userId: adminUser.id, companyFn: 'C-SG', roleId: superadminRole.id },
    { userId: adminUser.id, companyFn: 'C-MY', roleId: superadminRole.id },
    { userId: viewerUser.id, companyFn: 'C-SG', roleId: viewerRole.id },
  ]);

  await db.insert(rolePermission).values([
    'dashboard.read',
    'inventory.read',
    'sales.read',
    'finance.read',
    'purchasing.read',
    'crm.read',
    'session.switch_company',
  ].map((permissionKey) => ({
    masterFn: 'M1',
    roleId: viewerRole.id,
    permissionKey,
  })));

  await db.insert(product).values([
    { masterFn: 'M1', companyFn: 'C-SG', sku: 'SG-WIDGET', name: 'Widget (SG)', uom: 'unit', standardCost: '6.5000' },
    { masterFn: 'M1', companyFn: 'C-SG', sku: 'SG-GADGET', name: 'Gadget (SG)', uom: 'box', standardCost: '13.0000' },
    { masterFn: 'M1', companyFn: 'C-MY', sku: 'MY-WIDGET', name: 'Widget (MY)', uom: 'unit', standardCost: '6.0000' },
  ]);

  // SG GST standard-rated: 8% from 2023, 9% from 2024 (effective-dated).
  await db.insert(taxRule).values([
    { masterFn: 'M1', companyFn: 'C-SG', taxRegime: 'GST', taxCode: 'SR', rate: '8.000', validFrom: '2023-01-01', validTo: '2024-01-01' },
    { masterFn: 'M1', companyFn: 'C-SG', taxRegime: 'GST', taxCode: 'SR', rate: '9.000', validFrom: '2024-01-01', validTo: null },
    // MY SST service tax 8%.
    { masterFn: 'M1', companyFn: 'C-MY', taxRegime: 'SST', taxCode: 'SV', rate: '8.000', validFrom: '2025-07-01', validTo: null },
  ]);

  // A customer for the SG company.
  const [cust] = await db.insert(customer).values({
    masterFn: 'M1', companyFn: 'C-SG', code: 'CUST1', name: 'Beta Pte Ltd',
  }).returning({ id: customer.id });

  // A supplier for the SG company (TASK-022 — purchasing chain).
  await db.insert(supplier).values({ masterFn: 'M1', companyFn: 'C-SG', code: 'SUPP1', name: 'Gamma Supplies Pte Ltd' });

  // An open opportunity for CUST1, owned by the admin user (TASK-027 — CRM chain).
  // Left in 'negotiation' (not converted) so the demo shows an in-flight pipeline
  // deal; converting it is exercised by src/demo.ts's runCrmScenario, not the seed.
  await db.insert(opportunity).values({
    masterFn: 'M1', companyFn: 'C-SG', docNo: 'OPP-1', customerId: cust.id,
    title: 'Widget supply expansion', value: '5000.00', currency: 'SGD',
    stage: 'negotiation', probability: '75.00', closeDate: '2024-06-15', ownerUserId: adminUser.id,
  });

  // Minimal chart of accounts for the SG company (used by sales-order and
  // purchase-order posting).
  await db.insert(account).values([
    { masterFn: 'M1', companyFn: 'C-SG', code: '1100', name: 'Accounts Receivable', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '4000', name: 'Revenue', type: 'income' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '2200', name: 'GST Output Tax', type: 'liability' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '1400', name: 'Inventory', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '1200', name: 'GST Input Tax', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '2100', name: 'Accounts Payable', type: 'liability' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '5800', name: 'Inventory Variance', type: 'expense' },
  ]);
}

/** True if the demo master already exists (so we can avoid double-seeding). */
export async function isSeeded(db: DB): Promise<boolean> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(master);
  return (rows[0]?.n ?? 0) > 0;
}
