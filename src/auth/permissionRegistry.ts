import { PERMISSIONS } from './permissionKeys';

/**
 * Application-owned permission registry.
 *
 * The database still stores `role_permission.permission_key` as text for
 * expand/backfill compatibility. This registry is the authority for which
 * values may be stored or evaluated. Existing two-segment module keys are
 * compatibility aliases; their explicit wildcard canonical mapping lets the
 * API begin asking for `module.resource.action` without widening access.
 */
export type PermissionRegistryKind = 'canonical' | 'compatibility';
export type PermissionDomain = 'tenant' | 'platform';

export interface PermissionDefinition {
  code: string;
  canonicalCode: string;
  module: string;
  resource: string;
  action: string;
  domain: PermissionDomain;
  kind: PermissionRegistryKind;
  /** False means the code is recognized for migration/audit compatibility only. */
  assignable: boolean;
  deprecated?: boolean;
  telemetryKey?: string;
  removalGate?: string;
}

const ACTION_MODULES = [
  'sales', 'purchasing', 'crm', 'inventory', 'warehouse', 'manufacturing',
  'quality', 'finance', 'hr', 'payroll', 'project', 'service', 'asset',
] as const;
const ACTIONS = ['create', 'edit', 'approve', 'post', 'pay', 'export'] as const;
export const PERMISSION_ACTIONS = ACTIONS;

/** Existing broad action keys retained only as explicit compatibility grants. */
export const ACTION_PERMISSION_KEYS = ACTION_MODULES.flatMap((moduleKey) =>
  ACTIONS.map((action) => `${moduleKey}.${action}`));

const PLATFORM_PERMISSION_KEYS = [
  'platform.support.read',
  'platform.support.use',
  'platform.support.grant',
  'platform.support.revoke',
  'platform.modules.read',
  'platform.modules.manage',
  'platform.tenants.read',
  'platform.tenants.manage',
  'platform.simulation.manage',
] as const;

const MODULE_ALIASES: Record<string, string> = {
  admin: 'system',
  asset: 'asset',
  employee: 'hr',
  expenses: 'finance',
  session: 'system',
  settings: 'system',
};

const ACTION_ALIASES: Record<string, string> = {
  read: 'view',
  write: 'edit',
};

function canonicalPartsForCompatibility(code: string): {
  module: string;
  resource: string;
  action: string;
} {
  const parts = code.split('.');
  const sourceModule = parts.shift() ?? '';
  const sourceAction = parts.pop() ?? '';
  const module = MODULE_ALIASES[sourceModule] ?? sourceModule;
  const resource = parts.length ? parts.join('_') : '*';
  const action = ACTION_ALIASES[sourceAction] ?? sourceAction;
  return { module, resource, action };
}

function compatibilityDefinition(code: string): PermissionDefinition {
  const { module, resource, action } = canonicalPartsForCompatibility(code);
  const retiredTenantMac = code === PERMISSIONS.modulesManage;
  return {
    code,
    canonicalCode: `${module}.${resource}.${action}`,
    module,
    resource,
    action,
    domain: 'tenant',
    kind: 'compatibility',
    assignable: !retiredTenantMac,
    deprecated: retiredTenantMac || undefined,
    telemetryKey: `permission.compatibility.${code.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    removalGate: retiredTenantMac ? 'TASK-186-platform-mac-cutover' : 'TASK-171-compatibility-cutover',
  };
}

const compatibilityKeys = [
  ...new Set([...Object.values(PERMISSIONS), ...ACTION_PERMISSION_KEYS]),
];
const compatibilityDefinitions = compatibilityKeys.map(compatibilityDefinition);
const canonicalDefinitions = [...new Map(
  [
    ...compatibilityDefinitions
      .filter((definition) => definition.canonicalCode !== definition.code),
    ...PLATFORM_PERMISSION_KEYS.map((code) => ({
      code,
      canonicalCode: code,
      ...canonicalPartsForCompatibility(code),
      domain: 'platform' as const,
      kind: 'canonical' as const,
      assignable: false,
    })),
  ].map((definition) => [definition.canonicalCode, {
    ...definition,
    code: definition.canonicalCode,
    kind: 'canonical' as const,
    telemetryKey: undefined,
    removalGate: undefined,
  }]),
).values()];

/** Immutable application-owned registry; tenants may only compose these codes. */
export const PERMISSION_REGISTRY: readonly PermissionDefinition[] = Object.freeze([
  ...canonicalDefinitions,
  ...compatibilityDefinitions,
].map((definition) => Object.freeze(definition)));

const BY_CODE = new Map(PERMISSION_REGISTRY.map((definition) => [definition.code, definition]));
const BY_CANONICAL = new Map<string, PermissionDefinition[]>();
const ROUTE_PERMISSION_CODES = new Set<string>();
for (const definition of PERMISSION_REGISTRY) {
  const entries = BY_CANONICAL.get(definition.canonicalCode) ?? [];
  entries.push(definition);
  BY_CANONICAL.set(definition.canonicalCode, entries);
}

/** Legacy seed/template catalog. Canonical records are available separately. */
export const PERMISSION_CATALOG = Object.freeze(compatibilityDefinitions
  .filter((definition) => definition.assignable)
  .map((definition) => definition.code));

export function permissionDefinition(code: string): PermissionDefinition | undefined {
  return BY_CODE.get(code);
}

export function isRegisteredPermission(code: string): boolean {
  return BY_CODE.has(code);
}

export function isTenantPermission(code: string): boolean {
  return BY_CODE.get(code)?.domain === 'tenant';
}

export function isAssignableTenantPermission(code: string): boolean {
  const definition = BY_CODE.get(code);
  return definition?.domain === 'tenant' && definition.assignable;
}

export function isCompatibilityPermission(code: string): boolean {
  return BY_CODE.get(code)?.kind === 'compatibility';
}

export function canonicalPermissionForCompatibility(code: string): string | null {
  return BY_CODE.get(code)?.canonicalCode ?? null;
}

/**
 * Derive the registered canonical permission used by a resource route. The
 * resource definition itself is the allowlist, so this helper is not exposed
 * as a tenant-controlled parser. `assets` is the existing URL/module alias for
 * the `asset` permission module.
 */
export function canonicalPermissionForResource(
  resource: string,
  action: string,
  compatibilityCode?: string,
): string {
  const [rawModule, ...rawResourceParts] = resource.split('/');
  const compatibilityModule = compatibilityCode ? BY_CODE.get(compatibilityCode)?.module : undefined;
  const module = compatibilityModule
    ?? MODULE_ALIASES[rawModule === 'assets' ? 'asset' : rawModule]
    ?? rawModule;
  const resourceName = rawResourceParts.join('_').replace(/[^a-zA-Z0-9_]/g, '_');
  const normalizedAction = action.trim().toLowerCase().replace(/-/g, '_');
  if (!module || !normalizedAction) {
    throw new Error(`Cannot derive canonical permission for '${resource}:${action}'.`);
  }
  // A few legacy action definitions use a module-only resource label (for
  // example `documents`). Their explicit permission remains authoritative;
  // use its registry mapping as the optional fine-grained candidate rather
  // than treating the module-only label as a malformed route resource.
  if (!resourceName) {
    const compatibility = compatibilityCode ? BY_CODE.get(compatibilityCode) : undefined;
    if (compatibility?.domain === 'tenant') return compatibility.canonicalCode;
    return `${module}.*.${normalizedAction}`;
  }
  return `${module}.${resourceName}.${normalizedAction}`;
}

export function canonicalPermissionForAction(
  resource: string,
  action: string,
  compatibilityCode?: string,
): string {
  let canonicalAction = 'edit';
  if (/approve|reject|decide/.test(action)) canonicalAction = 'approve';
  else if (/export|download/.test(action)) canonicalAction = 'export';
  else if (/pay|release-payment/.test(action)) canonicalAction = 'pay';
  else if (/post|confirm|complete|release|reconcile/.test(action)) canonicalAction = 'post';
  return canonicalPermissionForResource(resource, canonicalAction, compatibilityCode);
}

/** Register a canonical code only from the application resource registry. */
export function registerRoutePermission(code: string): void {
  if (!isCanonicalPermissionShape(code)) {
    throw new Error(`Invalid canonical route permission '${code}'.`);
  }
  ROUTE_PERMISSION_CODES.add(code);
}

/**
 * Return the exact role_permission keys that can satisfy a request. Wildcard
 * compatibility records are explicit registry rows, not an implicit role or
 * seniority shortcut. Unknown permissions produce no candidates and deny.
 */
export function permissionCandidates(requestedCode: string): readonly string[] {
  const requested = BY_CODE.get(requestedCode);
  if (requested && requested.domain !== 'tenant') return [];
  if (requested) {
    const aliases = (BY_CANONICAL.get(requested.canonicalCode) ?? [])
      .filter((definition) => definition.kind === 'compatibility')
      .map((definition) => definition.code);
    return Object.freeze([...new Set([requestedCode, requested.canonicalCode, ...aliases])]);
  }

  const parts = requestedCode.split('.');
  if (parts.length !== 3 || parts.some((part) => !part) || !ROUTE_PERMISSION_CODES.has(requestedCode)) {
    return [];
  }
  const [module, , action] = parts;
  const matching = (BY_CANONICAL.get(requestedCode) ?? [])
    .concat(BY_CANONICAL.get(`${module}.*.${action}`) ?? [])
    .map((definition) => definition.code);
  return Object.freeze([...new Set([requestedCode, ...matching])]);
}

export function isRegisteredRoutePermission(code: string): boolean {
  return ROUTE_PERMISSION_CODES.has(code);
}

function isCanonicalPermissionShape(code: string): boolean {
  const parts = code.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return false;
  const [module, resource, action] = parts;
  if (!/^[a-z][a-z0-9_]*$/.test(module)
    || !/^[a-z][a-z0-9_]*$/.test(resource)
    || !/^[a-z][a-z0-9_]*$/.test(action)) return false;
  return resource !== '*' && action !== '*';
}

export const PERMISSION_REGISTRY_STATS = Object.freeze({
  canonical: canonicalDefinitions.length,
  compatibility: compatibilityDefinitions.length,
});

export type PermissionKey = string;
