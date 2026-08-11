import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from './permissionKeys';
import {
  ACTION_PERMISSION_KEYS,
  PERMISSION_REGISTRY,
  canonicalPermissionForResource,
  isAssignableTenantPermission,
  isRegisteredPermission,
  isTenantPermission,
  permissionCandidates,
  permissionDefinition,
} from './permissionRegistry';
import { listResourcePermissionContracts } from '../api/resources';

describe('application-owned permission registry', () => {
  it('registers every tenant compatibility key with explicit migration metadata', () => {
    const keys = [...new Set([...Object.values(PERMISSIONS), ...ACTION_PERMISSION_KEYS])];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const definition = permissionDefinition(key);
      expect(definition?.kind, key).toBe('compatibility');
      expect(definition?.canonicalCode, key).toMatch(/^[a-z][a-z0-9_]*\.(?:\*|[a-z][a-z0-9_]*)\.[a-z][a-z0-9_]*$/);
      expect(definition?.telemetryKey, key).toBeTruthy();
      expect(definition?.removalGate, key).toBe(
        key === PERMISSIONS.modulesManage
          ? 'TASK-186-platform-mac-cutover'
          : 'TASK-171-compatibility-cutover',
      );
      expect(isRegisteredPermission(key), key).toBe(true);
    }
  });

  it('recognizes retired tenant MAC permission without allowing new grants', () => {
    expect(permissionDefinition(PERMISSIONS.modulesManage)).toMatchObject({
      deprecated: true,
      assignable: false,
    });
    expect(isTenantPermission(PERMISSIONS.modulesManage)).toBe(true);
    expect(isAssignableTenantPermission(PERMISSIONS.modulesManage)).toBe(false);
  });

  it('resolves resource requests through explicit broad compatibility aliases', () => {
    expect(listResourcePermissionContracts().some((contract) => contract.resource === 'inventory/products'))
      .toBe(true);
    const request = canonicalPermissionForResource('inventory/products', 'view');
    expect(request).toBe('inventory.products.view');
    expect(permissionCandidates(request)).toEqual(expect.arrayContaining([
      request,
      'inventory.*.view',
      'inventory.read',
    ]));
    expect(permissionCandidates('unknown.resource.view')).toEqual([]);
  });

  it('keeps the registry application-owned and includes platform canonical keys', () => {
    expect(PERMISSION_REGISTRY.length).toBeGreaterThan(0);
    expect(permissionDefinition('platform.support.grant')).toMatchObject({
      kind: 'canonical',
      canonicalCode: 'platform.support.grant',
      domain: 'platform',
    });
    expect(isRegisteredPermission('platform.support.grant')).toBe(true);
    expect(isTenantPermission('platform.support.grant')).toBe(false);
    expect(permissionCandidates('platform.support.grant')).toEqual([]);
    expect(() => (PERMISSION_REGISTRY as unknown as Array<unknown>)[0] = undefined)
      .toThrow();
  });
});
