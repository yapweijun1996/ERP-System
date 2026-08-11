/** Request-local attribution injected only while a platform operator is
 * simulating a tenant user. It prevents existing tenant commands from losing
 * the real platform principal while preserving the target app_user as actor. */
export interface AuditAttribution {
  platformPrincipalId?: number;
}

interface AuditAttributionStorage {
  getStore(): AuditAttribution | undefined;
  run<T>(store: AuditAttribution, callback: () => T): T;
}

// This module is shared by API and PGlite/Demo domain code. The Node-only
// storage is installed by createApp(), so a browser import has a safe
// no-context fallback rather than evaluating node:async_hooks.
let storage: AuditAttributionStorage | undefined;

export function configureAuditAttributionStorage(next: AuditAttributionStorage): void {
  storage = next;
}

export function runWithAuditAttribution<T>(attribution: AuditAttribution, callback: () => T): T {
  return storage ? storage.run(attribution, callback) : callback();
}

export function currentAuditAttribution(): AuditAttribution | undefined {
  return storage?.getStore();
}
