import { AsyncLocalStorage } from 'node:async_hooks';

/** Request-local attribution injected only while a platform operator is
 * simulating a tenant user. It prevents existing tenant commands from losing
 * the real platform principal while preserving the target app_user as actor. */
export interface AuditAttribution {
  platformPrincipalId?: number;
}

const storage = new AsyncLocalStorage<AuditAttribution>();

export function runWithAuditAttribution<T>(attribution: AuditAttribution, callback: () => T): T {
  return storage.run(attribution, callback);
}

export function currentAuditAttribution(): AuditAttribution | undefined {
  return storage.getStore();
}
