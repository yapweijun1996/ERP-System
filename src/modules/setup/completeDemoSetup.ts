import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  account,
  appUser,
  company,
  companyModule,
  companyOnboarding,
  currency,
  master,
  role,
  rolePermission,
  taxRule,
  userCompany,
  userCompanyRole,
} from '../../data/schema';
import { PERMISSIONS } from '../../auth/permissions';
import { createDefaultControlPlane } from './defaultControlPlane';
import {
  isValidOrganizationCode,
  isValidUsername,
  normalizeOrganizationCode,
  normalizeUsername,
} from '../../auth/identifiers';
import { MODULE_KEYS } from '../../auth/moduleAccess';

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
  organizationCode: string;
  companyFn: string;
  companyName: string;
  country: 'SG' | 'MY';
  adminName: string;
  adminUsername: string;
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
  const organizationCode = normalizeOrganizationCode(required(
    input.organizationCode,
    'Organization code',
  ));
  if (!isValidOrganizationCode(organizationCode)) {
    throw new DemoSetupError('Use a 3–32 character organization code.');
  }
  const companyFn = required(input.companyFn, 'Company identifier');
  const companyName = required(input.companyName, 'Company name');
  const adminName = required(input.adminName, 'Admin user name');
  const adminUsername = normalizeUsername(required(input.adminUsername, 'Admin username'));
  if (!isValidUsername(adminUsername)) {
    throw new DemoSetupError('Use a valid 3–64 character admin username.');
  }
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

  const [existingUsername] = await exec.select({
    userId: appUser.userId,
    email: appUser.email,
  }).from(appUser).where(and(
    eq(appUser.masterFn, masterFn),
    eq(appUser.username, adminUsername),
  )).limit(1);
  if (existingUsername && existingUsername.email !== adminEmail) {
    throw new DemoSetupError(
      `Username ${adminUsername} already belongs to another demo account.`,
    );
  }
  const [existingEmail] = await exec.select({
    userId: appUser.userId,
    username: appUser.username,
  }).from(appUser).where(and(
    eq(appUser.masterFn, masterFn),
    eq(appUser.email, adminEmail),
  )).limit(1);
  if (existingEmail && existingEmail.username !== adminUsername) {
    throw new DemoSetupError(
      `Email ${adminEmail} already belongs to another demo username.`,
    );
  }

  const masterName = input.masterName?.trim();
  await exec.update(master).set({
    ...(masterName ? { name: masterName } : {}),
    loginCode: organizationCode,
    updatedAt: sql`now()`,
  }).where(eq(master.masterFn, masterFn));
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
  await createDefaultControlPlane(exec, { masterFn, companyFn }, input.country);
  await exec.insert(account).values([
    { masterFn, companyFn, code: '1100', name: 'Accounts Receivable', type: 'asset' },
    { masterFn, companyFn, code: '1200', name: 'Input Tax', type: 'asset' },
    { masterFn, companyFn, code: '1400', name: 'Inventory', type: 'asset' },
    { masterFn, companyFn, code: '1450', name: 'Work in Progress', type: 'asset' },
    { masterFn, companyFn, code: '2100', name: 'Accounts Payable', type: 'liability' },
    { masterFn, companyFn, code: '2200', name: 'Output Tax', type: 'liability' },
    { masterFn, companyFn, code: '2300', name: 'Landed Cost Accrual', type: 'liability' },
    { masterFn, companyFn, code: '3000', name: 'Owner Equity', type: 'equity' },
    { masterFn, companyFn, code: '4000', name: 'Revenue', type: 'income' },
    { masterFn, companyFn, code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
    { masterFn, companyFn, code: '5800', name: 'Inventory Variance', type: 'expense' },
  ]);

  let [adminRole] = await exec.select({ roleId: role.roleId })
    .from(role)
    .where(and(
      eq(role.masterFn, masterFn),
      eq(role.companyFn, companyFn),
      eq(role.name, 'Superadmin'),
    ));
  if (!adminRole) {
    [adminRole] = await exec.insert(role).values({
      masterFn,
      companyFn,
      name: 'Superadmin',
      isSuperadmin: true,
      sourceTemplateKey: 'superadmin',
    }).returning({ roleId: role.roleId });
  }
  await exec.insert(rolePermission).values(
    Object.values(PERMISSIONS).map((permissionKey) => ({
      masterFn,
      roleId: adminRole.roleId,
      permissionKey,
    })),
  ).onConflictDoNothing();

  let admin = existingUsername && existingEmail
    && existingUsername.userId === existingEmail.userId
    ? { userId: existingUsername.userId }
    : undefined;
  if (!admin) {
    [admin] = await exec.insert(appUser).values({
      masterFn,
      username: adminUsername,
      email: adminEmail,
      fullName: adminName,
      passwordHash: input.adminPasswordHash,
      language,
    }).returning({ userId: appUser.userId });
  } else {
    // The deterministic Demo pack already contains the canonical `admin`
    // identity. When first-run setup supplies that exact username/email pair,
    // honour the administrator details and password the user just entered
    // instead of silently retaining the seeded credentials.
    await exec.update(appUser).set({
      fullName: adminName,
      passwordHash: input.adminPasswordHash,
      language,
      isActive: true,
      accountState: 'active',
      passwordChangeRequired: false,
      initialPasswordExpiresAt: null,
      offboardedAt: null,
      updatedAt: sql`now()`,
    }).where(and(
      eq(appUser.masterFn, masterFn),
      eq(appUser.userId, admin.userId),
    ));
  }
  await exec.insert(userCompany).values({
    userId: admin.userId,
    companyFn,
    roleId: adminRole.roleId,
  }).onConflictDoNothing();
  await exec.insert(userCompanyRole).values({
    userId: admin.userId,
    companyFn,
    roleId: adminRole.roleId,
  }).onConflictDoNothing();
  await exec.insert(companyModule).values(MODULE_KEYS.map((moduleKey) => ({
    masterFn, companyFn, moduleKey, enabled: true, configured: true,
  }))).onConflictDoNothing();
  await exec.insert(companyOnboarding).values({
    masterFn, companyFn, status: 'live', currentStage: 'live',
    completedSteps: ['company', 'fiscal', 'warehouse', 'modules', 'roles', 'staff', 'import', 'opening_balance', 'uat'],
    goLiveAt: new Date(), goLiveByUserId: admin.userId,
  }).onConflictDoNothing();

  return {
    masterFn,
    companyFn,
    userId: admin.userId,
    organizationCode,
    username: adminUsername,
    email: adminEmail,
  };
}

export async function completeDemoSetup(db: DB, input: CompleteDemoSetupInput) {
  return db.transaction((tx) => completeDemoSetupWithin(tx, input));
}
