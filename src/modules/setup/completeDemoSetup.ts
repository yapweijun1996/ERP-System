import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  account,
  appUser,
  company,
  currency,
  master,
  role,
  rolePermission,
  taxRule,
  userCompany,
} from '../../data/schema';
import { PERMISSIONS } from '../../auth/permissions';

const SUPPORTED_LANGUAGES = new Set(['en', 'ms', 'zh', 'ja', 'vi']);

const COUNTRY_DEFAULTS = {
  SG: {
    currency: 'SGD',
    currencyName: 'Singapore Dollar',
    currencySymbol: 'S$',
    taxRegime: 'GST',
    taxCode: 'SR',
    taxRate: '9.000',
    taxValidFrom: '2024-01-01',
  },
  MY: {
    currency: 'MYR',
    currencyName: 'Malaysian Ringgit',
    currencySymbol: 'RM',
    taxRegime: 'SST',
    taxCode: 'SV',
    taxRate: '8.000',
    taxValidFrom: '2025-07-01',
  },
} as const;

export interface CompleteDemoSetupInput {
  masterFn: string;
  masterName?: string;
  companyFn: string;
  companyName: string;
  country: 'SG' | 'MY';
  adminName: string;
  adminEmail: string;
  adminPasswordHash: string;
  language?: string;
}

export class DemoSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoSetupError';
  }
}

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new DemoSetupError(`${label} is required.`);
  return normalized;
}

export async function completeDemoSetupWithin(
  exec: DB,
  input: CompleteDemoSetupInput,
) {
  const masterFn = required(input.masterFn, 'Master');
  const companyFn = required(input.companyFn, 'Company identifier');
  const companyName = required(input.companyName, 'Company name');
  const adminName = required(input.adminName, 'Admin user name');
  const adminEmail = required(input.adminEmail, 'Admin email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new DemoSetupError('Enter a valid admin email.');
  }
  if (
    typeof input.adminPasswordHash !== 'string'
    || !input.adminPasswordHash.startsWith('pbkdf2$')
  ) {
    throw new DemoSetupError('A PBKDF2 admin password hash is required.');
  }
  const defaults = COUNTRY_DEFAULTS[input.country];
  if (!defaults) throw new DemoSetupError('Demo setup currently supports SG and MY.');
  const language = SUPPORTED_LANGUAGES.has(input.language ?? '') ? input.language! : 'en';

  const [existingMaster] = await exec.select({ masterFn: master.masterFn })
    .from(master)
    .where(eq(master.masterFn, masterFn))
    .for('update');
  if (!existingMaster) throw new DemoSetupError(`Master ${masterFn} not found.`);

  const masterName = input.masterName?.trim();
  if (masterName) {
    await exec.update(master).set({ name: masterName, updatedAt: sql`now()` })
      .where(eq(master.masterFn, masterFn));
  }
  await exec.insert(currency).values({
    code: defaults.currency,
    name: defaults.currencyName,
    symbol: defaults.currencySymbol,
  }).onConflictDoNothing();
  await exec.insert(company).values({
    companyFn,
    masterFn,
    name: companyName,
    country: input.country,
    currency: defaults.currency,
    taxRegime: defaults.taxRegime,
    locale: language,
  });
  await exec.insert(taxRule).values({
    masterFn,
    companyFn,
    taxRegime: defaults.taxRegime,
    taxCode: defaults.taxCode,
    rate: defaults.taxRate,
    validFrom: defaults.taxValidFrom,
  });
  await exec.insert(account).values([
    { masterFn, companyFn, code: '1100', name: 'Accounts Receivable', type: 'asset' },
    { masterFn, companyFn, code: '1200', name: 'Input Tax', type: 'asset' },
    { masterFn, companyFn, code: '1400', name: 'Inventory', type: 'asset' },
    { masterFn, companyFn, code: '1450', name: 'Work in Progress', type: 'asset' },
    { masterFn, companyFn, code: '2100', name: 'Accounts Payable', type: 'liability' },
    { masterFn, companyFn, code: '2200', name: 'Output Tax', type: 'liability' },
    { masterFn, companyFn, code: '3000', name: 'Owner Equity', type: 'equity' },
    { masterFn, companyFn, code: '4000', name: 'Revenue', type: 'income' },
    { masterFn, companyFn, code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
    { masterFn, companyFn, code: '5800', name: 'Inventory Variance', type: 'expense' },
  ]);

  let [adminRole] = await exec.select({ roleId: role.roleId })
    .from(role)
    .where(and(eq(role.masterFn, masterFn), eq(role.name, 'Superadmin')));
  if (!adminRole) {
    [adminRole] = await exec.insert(role).values({
      masterFn,
      name: 'Superadmin',
      isSuperadmin: true,
    }).returning({ roleId: role.roleId });
  }
  await exec.insert(rolePermission).values(
    Object.values(PERMISSIONS).map((permissionKey) => ({
      masterFn,
      roleId: adminRole.roleId,
      permissionKey,
    })),
  ).onConflictDoNothing();

  let [admin] = await exec.select({ userId: appUser.userId })
    .from(appUser)
    .where(and(eq(appUser.masterFn, masterFn), eq(appUser.email, adminEmail)));
  if (!admin) {
    [admin] = await exec.insert(appUser).values({
      masterFn,
      email: adminEmail,
      fullName: adminName,
      passwordHash: input.adminPasswordHash,
      language,
    }).returning({ userId: appUser.userId });
  }
  await exec.insert(userCompany).values({
    userId: admin.userId,
    companyFn,
    roleId: adminRole.roleId,
  }).onConflictDoNothing();

  return {
    masterFn,
    companyFn,
    userId: admin.userId,
    email: adminEmail,
  };
}

export async function completeDemoSetup(db: DB, input: CompleteDemoSetupInput) {
  return db.transaction((tx) => completeDemoSetupWithin(tx, input));
}
