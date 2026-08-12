/** Platform permissions live in a separate authorization realm and are never
 * registered as tenant role permissions. Keep this catalogue browser-safe because
 * deterministic Demo seed code imports it without importing platform session crypto. */
export const PLATFORM_PERMISSIONS = {
  modulesRead: 'platform.modules.read',
  modulesManage: 'platform.modules.manage',
  tenantsRead: 'platform.tenants.read',
  tenantsManage: 'platform.tenants.manage',
  simulationManage: 'platform.simulation.manage',
  supportRead: 'platform.support.read',
  supportUse: 'platform.support.use',
  supportGrant: 'platform.support.grant',
  supportRevoke: 'platform.support.revoke',
} as const;

export type PlatformPermission = typeof PLATFORM_PERMISSIONS[keyof typeof PLATFORM_PERMISSIONS];
