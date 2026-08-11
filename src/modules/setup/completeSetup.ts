import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  account,
  appUser,
  company,
  companyOnboarding,
  currency,
  master,
  role,
  rolePermission,
  roleResourceScope,
  systemState,
  taxRule,
  userCompany,
  userCompanyRole,
} from '../../data/schema';
import { appendAudit } from '../../api/audit';
import { hashPassword } from '../../auth/password';
import { COMPANY_OWNER_PERMISSION_KEYS, COMPANY_OWNER_ROLE_TEMPLATE_KEY } from '../../auth/accessCatalog';
import {
  isValidOrganizationCode,
  isValidUsername,
  normalizeOrganizationCode,
  normalizeUsername,
} from '../../auth/identifiers';
import { createDefaultControlPlane } from './defaultControlPlane';
import { applyMasterCompanyAllocationDefaultsWithin } from '../../auth/moduleProvisioning';

const SETUP_STATE_KEY = 'production_setup';
const SUPPORTED_LANGUAGES = new Set(['en', 'ms', 'zh', 'ja', 'vi']);

interface CountryDefaults {
  currency: string;
  currencyName: string;
  currencySymbol: string;
  taxRegime: string;
  taxCode: string;
  taxRate: string;
  taxValidFrom: string;
}

const COUNTRY_DEFAULTS: Record<string, CountryDefaults> = {
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
};

export class SetupError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export interface CompleteSetupInput {
  organizationName: string;
  organizationCode: string;
  companyName: string;
  country: string;
  adminName: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
  language?: string;
}

function required(value: string | undefined, field: string, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new SetupError(400, 'invalid_request', `${label} is required.`, {
      [field]: `${label} is required.`,
    });
  }
  return normalized;
}

export async function completeProductionSetup(
  db: DB,
  input: CompleteSetupInput,
  requestId: string,
): Promise<{
  masterFn: string;
  companyFn: string;
  userId: number;
  organizationCode: string;
  username: string;
  email: string;
}> {
  const organizationName = required(input.organizationName, 'organizationName', 'Organization name');
  const organizationCode = normalizeOrganizationCode(required(
    input.organizationCode,
    'organizationCode',
    'Organization code',
  ));
  if (!isValidOrganizationCode(organizationCode)) {
    throw new SetupError(400, 'invalid_request', 'Enter a valid organization code.', {
      organizationCode: 'Use 3–32 letters, numbers or hyphens.',
    });
  }
  const companyName = required(input.companyName, 'companyName', 'Company name');
  const adminName = required(input.adminName, 'adminName', 'Admin name');
  const adminUsername = normalizeUsername(required(
    input.adminUsername,
    'adminUsername',
    'Admin username',
  ));
  if (!isValidUsername(adminUsername)) {
    throw new SetupError(400, 'invalid_request', 'Enter a valid admin username.', {
      adminUsername: 'Use 3–64 lowercase letters, numbers, dots, underscores or hyphens.',
    });
  }
  const adminEmail = required(input.adminEmail, 'adminEmail', 'Admin email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new SetupError(400, 'invalid_request', 'Enter a valid admin email.', {
      adminEmail: 'Enter a valid email address.',
    });
  }
  if ((input.adminPassword ?? '').length < 8) {
    throw new SetupError(400, 'invalid_request', 'Password must be at least 8 characters.', {
      adminPassword: 'Use at least 8 characters.',
    });
  }
  const country = input.country?.trim().toUpperCase();
  const defaults = COUNTRY_DEFAULTS[country];
  if (!defaults) {
    throw new SetupError(400, 'unsupported_country', 'Production setup currently supports SG and MY.', {
      country: 'Choose Singapore or Malaysia.',
    });
  }
  const language = SUPPORTED_LANGUAGES.has(input.language ?? '') ? input.language! : 'en';
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  const masterFn = `M-${suffix}`;
  const companyFn = `C-${country}-${suffix}`;

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.master_fn', ${masterFn}, true)`);
    await tx.execute(sql`select set_config('app.company_fn', ${companyFn}, true)`);
    await tx.insert(systemState).values({
      key: SETUP_STATE_KEY,
      value: { status: 'initializing' },
    }).onConflictDoNothing();
    const [setupState] = await tx.select({ value: systemState.value })
      .from(systemState)
      .where(eq(systemState.key, SETUP_STATE_KEY))
      .limit(1)
      .for('update');
    if ((setupState?.value as { status?: string } | undefined)?.status === 'completed') {
      throw new SetupError(409, 'already_initialized', 'Production setup is already complete.');
    }
    const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(appUser);
    if ((count?.n ?? 0) > 0) {
      throw new SetupError(409, 'already_initialized', 'Production setup is already complete.');
    }

    await tx.insert(currency).values({
      code: defaults.currency,
      name: defaults.currencyName,
      symbol: defaults.currencySymbol,
    }).onConflictDoNothing();
    await tx.insert(master).values({
      masterFn,
      loginCode: organizationCode,
      name: organizationName,
    });
    await tx.insert(company).values({
      companyFn,
      masterFn,
      name: companyName,
      country,
      currency: defaults.currency,
      taxRegime: defaults.taxRegime,
      locale: language,
    });
    const [adminRole] = await tx.insert(role).values({
      masterFn,
      companyFn,
      name: 'Company Owner',
      isSuperadmin: false,
      sourceTemplateKey: COMPANY_OWNER_ROLE_TEMPLATE_KEY,
    }).returning({ roleId: role.roleId });
    const [admin] = await tx.insert(appUser).values({
      masterFn,
      username: adminUsername,
      email: adminEmail,
      fullName: adminName,
      passwordHash: hashPassword(input.adminPassword),
      language,
    }).returning({ userId: appUser.userId });
    await tx.insert(userCompany).values({
      userId: admin.userId,
      companyFn,
      roleId: adminRole.roleId,
    });
    await tx.insert(userCompanyRole).values({
      userId: admin.userId,
      companyFn,
      roleId: adminRole.roleId,
      assignedByUserId: admin.userId,
      assignmentSource: 'onboarding',
    });
    await tx.insert(rolePermission).values(
      COMPANY_OWNER_PERMISSION_KEYS.map((permissionKey) => ({
        masterFn,
        roleId: adminRole.roleId,
        permissionKey,
      })),
    );
    await tx.insert(roleResourceScope).values({
      masterFn,
      companyFn,
      roleId: adminRole.roleId,
      resourceKey: '*',
      scope: 'company',
    });
    await tx.insert(taxRule).values({
      masterFn,
      companyFn,
      taxRegime: defaults.taxRegime,
      taxCode: defaults.taxCode,
      rate: defaults.taxRate,
      validFrom: defaults.taxValidFrom,
    });
    await createDefaultControlPlane(tx, { masterFn, companyFn }, country as 'SG' | 'MY');
    await applyMasterCompanyAllocationDefaultsWithin(tx, masterFn, companyFn);
    await tx.insert(companyOnboarding).values({
      masterFn,
      companyFn,
      status: 'setup',
      currentStage: 'fiscal',
      completedSteps: ['company'],
    });
    await tx.insert(account).values([
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
    await appendAudit(tx, {
      masterFn,
      companyFn,
      actorUserId: admin.userId,
      requestId,
      entity: 'system',
      entityId: SETUP_STATE_KEY,
      action: 'production_setup',
      after: {
        masterFn,
        companyFn,
        organizationCode,
        userId: admin.userId,
        username: adminUsername,
        country,
        language,
      },
    });
    await tx.update(systemState).set({
      value: {
        status: 'bootstrap_completed',
        masterFn,
        companyFn,
        completedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    }).where(eq(systemState.key, SETUP_STATE_KEY));
    return {
      masterFn,
      companyFn,
      userId: admin.userId,
      email: adminEmail,
      organizationCode,
      username: adminUsername,
    };
  });
}
