import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  account,
  appUser,
  company,
  companyOnboarding,
  currency,
  master,
  masterAdminAccount,
  masterModule,
  role,
  rolePermission,
  roleResourceScope,
  taxRule,
  userCompany,
  userCompanyRole,
} from '../../data/schema';
import { appendAudit } from '../../api/audit';
import { hashPassword } from '../../auth/password';
import {
  COMPANY_OWNER_PERMISSION_KEYS,
  COMPANY_OWNER_ROLE_TEMPLATE_KEY,
  MASTER_ADMIN_PERMISSION_KEYS,
  MASTER_ADMIN_ROLE_TEMPLATE_KEY,
} from '../../auth/accessCatalog';
import {
  isValidOrganizationCode,
  isValidUsername,
  normalizeOrganizationCode,
  normalizeUsername,
} from '../../auth/identifiers';
import {
  COMMERCIAL_MODULE_CATALOG,
  commercialModuleDefinition,
} from '../../auth/moduleCatalog';
import {
  applyMasterCompanyAllocationDefaultsWithin,
  initializeMasterEntitlementDefaultsWithin,
} from '../../auth/moduleProvisioning';
import {
  PLATFORM_PERMISSIONS,
  PlatformAccessError,
  requirePlatformPermission,
  type PlatformSessionData,
} from '../../auth/platformSupport';
import { createDefaultControlPlane } from './defaultControlPlane';

const SUPPORTED_LANGUAGES = new Set(['en', 'ms', 'zh', 'ja', 'vi']);
const COUNTRY_DEFAULTS = {
  SG: { currency: 'SGD', currencyName: 'Singapore Dollar', currencySymbol: 'S$', taxRegime: 'GST', taxCode: 'SR', taxRate: '9.000', taxValidFrom: '2024-01-01' },
  MY: { currency: 'MYR', currencyName: 'Malaysian Ringgit', currencySymbol: 'RM', taxRegime: 'SST', taxCode: 'SV', taxRate: '8.000', taxValidFrom: '2025-07-01' },
} as const;

export interface MasterProvisioningInput {
  name: string;
  loginCode: string;
  modules?: Array<{ moduleKey: string; enabled: boolean; defaultCompanyAllocated: boolean }>;
}

export interface ProvisionedAccountInput {
  name: string;
  username: string;
  email: string;
  password: string;
  language?: string;
}

export interface CompanyProvisioningInput {
  masterFn: string;
  name: string;
  country: string;
  language?: string;
  masterAdmin?: ProvisionedAccountInput;
  companyOwner: ProvisionedAccountInput;
}

function required(value: unknown, label: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new PlatformAccessError(400, 'invalid_request', `${label} is required.`);
  return normalized;
}

function validateAccount(input: ProvisionedAccountInput, label: string): ProvisionedAccountInput {
  const name = required(input?.name, `${label} name`);
  const username = normalizeUsername(required(input?.username, `${label} username`));
  if (!isValidUsername(username)) {
    throw new PlatformAccessError(400, 'invalid_request', `${label} username is invalid.`);
  }
  const email = required(input?.email, `${label} email`).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new PlatformAccessError(400, 'invalid_request', `${label} email is invalid.`);
  }
  if (typeof input?.password !== 'string' || input.password.length < 8 || input.password.length > 1024) {
    throw new PlatformAccessError(400, 'invalid_request', `${label} password must be from 8 to 1024 characters.`);
  }
  return { name, username, email, password: input.password, language: input.language };
}

function validateModuleOverrides(input: MasterProvisioningInput['modules']): Map<string, { enabled: boolean; defaultCompanyAllocated: boolean }> {
  const overrides = new Map<string, { enabled: boolean; defaultCompanyAllocated: boolean }>();
  for (const row of input ?? []) {
    if (!commercialModuleDefinition(row.moduleKey)
      || typeof row.enabled !== 'boolean'
      || typeof row.defaultCompanyAllocated !== 'boolean'
      || overrides.has(row.moduleKey)) {
      throw new PlatformAccessError(400, 'invalid_module_configuration', 'Each module override must name a unique commercial module and contain boolean flags.');
    }
    overrides.set(row.moduleKey, { enabled: row.enabled, defaultCompanyAllocated: row.defaultCompanyAllocated });
  }
  return overrides;
}

function validateDependencies(values: Map<string, { enabled: boolean; defaultCompanyAllocated: boolean }>): void {
  for (const definition of COMMERCIAL_MODULE_CATALOG) {
    const row = values.get(definition.key);
    if (!row) continue;
    for (const dependency of definition.dependencies) {
      const dependencyRow = values.get(dependency);
      if (row.enabled && dependencyRow?.enabled !== true) {
        throw new PlatformAccessError(400, 'platform_module_dependency_conflict', `${definition.name} requires enabled dependency ${dependency}.`);
      }
      if (row.defaultCompanyAllocated && dependencyRow?.defaultCompanyAllocated !== true) {
        throw new PlatformAccessError(400, 'platform_module_dependency_conflict', `${definition.name} requires allocated dependency ${dependency}.`);
      }
    }
  }
}

export async function createMasterWithin(
  exec: DB,
  session: PlatformSessionData,
  input: MasterProvisioningInput,
  requestId: string,
) {
  requirePlatformPermission(session, PLATFORM_PERMISSIONS.tenantsManage);
  const name = required(input.name, 'Master name');
  if (name.length > 160) throw new PlatformAccessError(400, 'invalid_request', 'Master name is too long.');
  const loginCode = normalizeOrganizationCode(required(input.loginCode, 'Master login code'));
  if (!isValidOrganizationCode(loginCode)) {
    throw new PlatformAccessError(400, 'invalid_request', 'Enter a valid Master login code.');
  }
  const overrides = validateModuleOverrides(input.modules);
  const defaults = new Map(COMMERCIAL_MODULE_CATALOG.map((definition) => [definition.key, {
    enabled: definition.key !== 'expenses_tax',
    defaultCompanyAllocated: definition.key !== 'expenses_tax',
  }]));
  for (const [key, value] of overrides) {
    defaults.set(key as typeof COMMERCIAL_MODULE_CATALOG[number]['key'], value);
  }
  validateDependencies(defaults);
  const [existing] = await exec.select({ masterFn: master.masterFn })
    .from(master).where(eq(master.loginCode, loginCode)).limit(1);
  if (existing) throw new PlatformAccessError(409, 'master_login_code_exists', 'A Master with this login code already exists.');
  const masterFn = `M-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  await exec.insert(master).values({ masterFn, loginCode, name });
  await initializeMasterEntitlementDefaultsWithin(exec, masterFn);
  for (const [moduleKey, value] of defaults) {
    const baseline = moduleKey !== 'expenses_tax';
    if (value.enabled !== baseline || value.defaultCompanyAllocated !== baseline) {
      await exec.update(masterModule).set({
        enabled: value.enabled,
        defaultCompanyAllocated: value.defaultCompanyAllocated,
        updatedAt: new Date(),
      }).where(and(eq(masterModule.masterFn, masterFn), eq(masterModule.moduleKey, moduleKey)));
    }
  }
  await appendAudit(exec, {
    masterFn,
    platformPrincipalId: session.principalId,
    requestId,
    entity: 'master',
    entityId: masterFn,
    action: 'platform_create',
    after: { masterFn, loginCode, name },
  });
  return {
    masterFn,
    loginCode,
    name,
    companyCount: 0,
    modules: [...defaults.entries()].map(([moduleKey, flags]) => ({ moduleKey, ...flags })),
  };
}

async function insertRole(
  exec: DB,
  masterFn: string,
  companyFn: string,
  name: string,
  sourceTemplateKey: string,
  permissions: readonly string[],
  scopes: readonly string[],
) {
  const [created] = await exec.insert(role).values({
    masterFn, companyFn, name, isSuperadmin: false, sourceTemplateKey,
  }).returning({ roleId: role.roleId });
  await exec.insert(rolePermission).values(permissions.map((permissionKey) => ({
    masterFn, roleId: created.roleId, permissionKey,
  })));
  await exec.insert(roleResourceScope).values(scopes.map((resourceKey) => ({
    masterFn, companyFn, roleId: created.roleId, resourceKey, scope: 'company' as const,
  })));
  return created.roleId;
}

async function insertUser(
  exec: DB,
  masterFn: string,
  input: ProvisionedAccountInput,
  language: string,
) {
  const [created] = await exec.insert(appUser).values({
    masterFn,
    username: input.username,
    email: input.email,
    fullName: input.name,
    passwordHash: hashPassword(input.password),
    language,
  }).returning({ userId: appUser.userId });
  return created.userId;
}

export async function createCompanyWithin(
  exec: DB,
  session: PlatformSessionData,
  input: CompanyProvisioningInput,
  requestId: string,
) {
  requirePlatformPermission(session, PLATFORM_PERMISSIONS.tenantsManage);
  const masterFn = required(input.masterFn, 'Master');
  const [parent] = await exec.select({ masterFn: master.masterFn, name: master.name })
    .from(master).where(eq(master.masterFn, masterFn)).limit(1);
  if (!parent) throw new PlatformAccessError(404, 'platform_target_not_found', 'Master was not found.');
  const name = required(input.name, 'Company name');
  if (name.length > 160) throw new PlatformAccessError(400, 'invalid_request', 'Company name is too long.');
  const country = required(input.country, 'Country').toUpperCase() as keyof typeof COUNTRY_DEFAULTS;
  const defaults = COUNTRY_DEFAULTS[country];
  if (!defaults) throw new PlatformAccessError(400, 'unsupported_country', 'Production provisioning currently supports SG and MY.');
  const language = SUPPORTED_LANGUAGES.has(input.language ?? '') ? input.language! : 'en';
  const owner = validateAccount(input.companyOwner, 'Company Owner');
  const [existingMasterAdmin] = await exec.select({ userId: masterAdminAccount.userId })
    .from(masterAdminAccount).where(eq(masterAdminAccount.masterFn, masterFn)).limit(1);
  const masterAdmin = existingMasterAdmin ? null : validateAccount(input.masterAdmin as ProvisionedAccountInput, 'Master Admin');
  if (masterAdmin && (masterAdmin.email === owner.email || masterAdmin.username === owner.username)) {
    throw new PlatformAccessError(409, 'duplicate_admin_identity', 'Master Admin and Company Owner identities must be different.');
  }
  const [duplicateUser] = await exec.select({ userId: appUser.userId })
    .from(appUser).where(and(eq(appUser.masterFn, masterFn), eq(appUser.email, owner.email))).limit(1);
  if (duplicateUser) throw new PlatformAccessError(409, 'user_exists', 'A user with this Company Owner email already exists.');
  const [duplicateUsername] = await exec.select({ userId: appUser.userId })
    .from(appUser).where(and(eq(appUser.masterFn, masterFn), eq(appUser.username, owner.username))).limit(1);
  if (duplicateUsername) throw new PlatformAccessError(409, 'username_exists', 'A user with this Company Owner username already exists.');
  if (masterAdmin) {
    const [duplicateMasterEmail] = await exec.select({ userId: appUser.userId })
      .from(appUser).where(and(eq(appUser.masterFn, masterFn), eq(appUser.email, masterAdmin.email))).limit(1);
    if (duplicateMasterEmail) throw new PlatformAccessError(409, 'user_exists', 'A user with this Master Admin email already exists.');
    const [duplicateMasterUsername] = await exec.select({ userId: appUser.userId })
      .from(appUser).where(and(eq(appUser.masterFn, masterFn), eq(appUser.username, masterAdmin.username))).limit(1);
    if (duplicateMasterUsername) throw new PlatformAccessError(409, 'username_exists', 'A user with this Master Admin username already exists.');
  }

  const companyFn = `C-${country}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  await exec.insert(currency).values({
    code: defaults.currency, name: defaults.currencyName, symbol: defaults.currencySymbol,
  }).onConflictDoNothing();
  await exec.insert(company).values({
    companyFn, masterFn, name, country, currency: defaults.currency,
    taxRegime: defaults.taxRegime, locale: language,
  });
  const ownerRoleId = await insertRole(
    exec, masterFn, companyFn, 'Company Owner', COMPANY_OWNER_ROLE_TEMPLATE_KEY,
    COMPANY_OWNER_PERMISSION_KEYS, ['*'],
  );
  const masterRoleId = await insertRole(
    exec, masterFn, companyFn, 'Master Admin', MASTER_ADMIN_ROLE_TEMPLATE_KEY,
    MASTER_ADMIN_PERMISSION_KEYS, ['admin/*', 'settings/*'],
  );
  const ownerUserId = await insertUser(exec, masterFn, owner, language);
  await exec.insert(userCompany).values({ userId: ownerUserId, companyFn, roleId: ownerRoleId });
  await exec.insert(userCompanyRole).values({
    userId: ownerUserId, companyFn, roleId: ownerRoleId,
    managedBySystem: true, assignmentSource: 'system',
  });

  let masterAdminUserId = existingMasterAdmin?.userId ?? null;
  if (masterAdmin) {
    masterAdminUserId = await insertUser(exec, masterFn, masterAdmin, language);
    await exec.insert(masterAdminAccount).values({ masterFn, userId: masterAdminUserId });
  }
  if (!masterAdminUserId) throw new PlatformAccessError(500, 'master_admin_unavailable', 'Master Admin identity could not be provisioned.');
  await exec.insert(userCompany).values({ userId: masterAdminUserId, companyFn, roleId: masterRoleId });
  await exec.insert(userCompanyRole).values({
    userId: masterAdminUserId, companyFn, roleId: masterRoleId,
    managedBySystem: true, assignmentSource: 'system',
  });

  await exec.insert(taxRule).values({
    masterFn, companyFn, taxRegime: defaults.taxRegime, taxCode: defaults.taxCode,
    rate: defaults.taxRate, validFrom: defaults.taxValidFrom,
  });
  await createDefaultControlPlane(exec, { masterFn, companyFn }, country);
  await applyMasterCompanyAllocationDefaultsWithin(exec, masterFn, companyFn);
  await exec.insert(companyOnboarding).values({
    masterFn,
    companyFn,
    status: 'live',
    currentStage: 'live',
    completedSteps: ['company', 'fiscal', 'warehouse', 'modules', 'roles', 'staff', 'import', 'opening_balance', 'uat'],
    goLiveAt: new Date(),
  });
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
  await appendAudit(exec, {
    masterFn, companyFn, platformPrincipalId: session.principalId, requestId,
    entity: 'company', entityId: companyFn, action: 'platform_create',
    after: { masterFn, companyFn, name, country, ownerUserId, masterAdminUserId },
  });
  return {
    masterFn, companyFn, name, country,
    companyOwner: { userId: ownerUserId, username: owner.username, email: owner.email },
    masterAdmin: { userId: masterAdminUserId },
  };
}

export async function listProvisioningMasters(exec: DB) {
  const rows = await exec.select({ masterFn: master.masterFn, loginCode: master.loginCode, name: master.name })
    .from(master).orderBy(asc(master.name), asc(master.masterFn));
  const companies = await exec.select({ masterFn: company.masterFn, companyFn: company.companyFn, name: company.name, country: company.country })
    .from(company).orderBy(asc(company.masterFn), asc(company.name), asc(company.companyFn));
  const adminRows = await exec.select({ masterFn: masterAdminAccount.masterFn, userId: masterAdminAccount.userId })
    .from(masterAdminAccount);
  return rows.map((item) => ({
    ...item,
    companyCount: companies.filter((row) => row.masterFn === item.masterFn).length,
    hasMasterAdmin: adminRows.some((row) => row.masterFn === item.masterFn),
    companies: companies.filter((row) => row.masterFn === item.masterFn),
  }));
}
