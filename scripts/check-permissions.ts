#!/usr/bin/env node
/**
 * Permission registry CI gate (TASK-171).
 *
 * This intentionally checks application declarations and the resource/action
 * registries, not historical SQL migrations. Old migrations are immutable
 * compatibility inputs; new source declarations must use the application-owned
 * registry and every route projection must have an exact canonical registration.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTION_PERMISSION_KEYS,
  PERMISSION_CATALOG,
  PERMISSION_REGISTRY,
  canonicalPermissionForAction,
  isTenantPermission,
  isRegisteredRoutePermission,
  permissionDefinition,
} from '../src/auth/permissionRegistry';
import { PERMISSIONS } from '../src/auth/permissionKeys';
import { ROLE_TEMPLATES, fineGrainedActionPermission } from '../src/auth/accessCatalog';
import {
  actionDefinitionFor,
  listActionPermissionContracts,
} from '../src/api/actions';
import { listResourcePermissionContracts } from '../src/api/resources';
import { createDefinitionFor } from '../src/api/creates';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const errors: string[] = [];

function requireRegistered(code: string, source: string): void {
  if (!isTenantPermission(code)) errors.push(`${source}: unknown tenant permission '${code}'`);
}

const files: string[] = [];
function walk(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.isFile() && target.endsWith('.ts') && !target.endsWith('.test.ts')) files.push(target);
  }
}
walk(path.join(ROOT, 'src'));

const literalPermission = /\b(?:permission|permissionKey|authorityPermissionKey|fallbackPermissionKey|escalationPermissionKey|extraApprovalPermissionKey|budgetExtraApprovalPermissionKey|currentAuthorityPermissionKey)\s*:\s*['"]([^'"]+)['"]/g;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  let match: RegExpExecArray | null;
  while ((match = literalPermission.exec(source))) {
    requireRegistered(match[1], path.relative(ROOT, file));
  }
}

for (const code of [...Object.values(PERMISSIONS), ...ACTION_PERMISSION_KEYS, ...PERMISSION_CATALOG]) {
  requireRegistered(code, 'catalog');
}

for (const template of ROLE_TEMPLATES) {
  for (const code of template.permissions) requireRegistered(code, `role template ${template.key}`);
}

const resourceContracts = listResourcePermissionContracts();
for (const contract of resourceContracts) {
  requireRegistered(contract.readPermission, `${contract.resource}.read compatibility`);
  if (contract.createPermission) requireRegistered(contract.createPermission, `${contract.resource}.create compatibility`);
  if (contract.updatePermission) requireRegistered(contract.updatePermission, `${contract.resource}.edit compatibility`);
  if (!isRegisteredRoutePermission(contract.canonicalReadPermission)) {
    errors.push(`${contract.resource}.read: canonical permission is not registered (${contract.canonicalReadPermission})`);
  }
  if (contract.canonicalCreatePermission && !isRegisteredRoutePermission(contract.canonicalCreatePermission)) {
    errors.push(`${contract.resource}.create: canonical permission is not registered (${contract.canonicalCreatePermission})`);
  }
  if (contract.canonicalUpdatePermission && !isRegisteredRoutePermission(contract.canonicalUpdatePermission)) {
    errors.push(`${contract.resource}.edit: canonical permission is not registered (${contract.canonicalUpdatePermission})`);
  }
  for (const [action, code] of Object.entries(contract.canonicalActionPermissions)) {
    if (!isRegisteredRoutePermission(code)) {
      errors.push(`${contract.resource}/${action}: canonical permission is not registered (${code})`);
    }
    const actionDefinition = actionDefinitionFor(contract.resource, action);
    if (!actionDefinition) errors.push(`${contract.resource}/${action}: action definition is missing`);
    else {
      requireRegistered(actionDefinition.permission, `${contract.resource}/${action}`);
      const dynamicCode = fineGrainedActionPermission(contract.resource, action, actionDefinition.permission);
      if (!isRegisteredRoutePermission(dynamicCode)) {
        errors.push(`${contract.resource}/${action}: dynamic canonical permission is not registered (${dynamicCode})`);
      }
    }
  }
  if (contract.createPermission && !createDefinitionFor(contract.resource)) {
    errors.push(`${contract.resource}: create permission has no create command`);
  }
}

for (const contract of listActionPermissionContracts()) {
  requireRegistered(contract.permission, `action ${contract.resource}/${contract.action}`);
  const dynamicCode = canonicalPermissionForAction(contract.resource, contract.action, contract.permission);
  if (!isRegisteredRoutePermission(dynamicCode)) {
    errors.push(`action ${contract.resource}/${contract.action}: canonical permission is not registered (${dynamicCode})`);
  }
}

const duplicateCodes = PERMISSION_REGISTRY
  .map((definition) => definition.code)
  .filter((code, index, all) => all.indexOf(code) !== index);
if (duplicateCodes.length) errors.push(`registry contains duplicate codes: ${[...new Set(duplicateCodes)].join(', ')}`);

const compatibilityWithoutGate = PERMISSION_REGISTRY.filter((definition) => definition.kind === 'compatibility')
  .filter((definition) => !definition.telemetryKey || !definition.removalGate || !permissionDefinition(definition.code)?.canonicalCode);
if (compatibilityWithoutGate.length) {
  errors.push(`compatibility entries missing mapping telemetry/removal gate: ${compatibilityWithoutGate.map((row) => row.code).join(', ')}`);
}

if (errors.length) {
  console.error(`Permission registry check failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}

console.log([
  `Permission registry OK: ${PERMISSION_REGISTRY.length} registered codes`,
  `${resourceContracts.length} resources`,
  `${listActionPermissionContracts().length} actions`,
  `${resourceContracts.filter((contract) => contract.updatePermission).length} updates`,
].join('; '));
