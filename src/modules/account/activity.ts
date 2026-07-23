import {
  and, desc, eq, lt,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import { auditLog } from '../../data/schema';

export interface PersonalActivityScope {
  masterFn: string;
  companyFn: string;
}

export type PersonalActivityCategory =
  | 'sales' | 'purchasing' | 'crm' | 'inventory' | 'warehouse'
  | 'manufacturing' | 'quality' | 'finance' | 'assets' | 'project'
  | 'service' | 'hr' | 'payroll' | 'admin' | 'integration' | 'system';

export type PersonalActivityAction =
  | 'create' | 'approve' | 'reject' | 'post' | 'reverse' | 'update' | 'other';

export interface PersonalActivityRow {
  id: number;
  category: PersonalActivityCategory;
  entityKey: string;
  entityId: string | null;
  actionKind: PersonalActivityAction;
  occurredAt: Date;
}

const CATEGORY_KEYS = new Set<PersonalActivityCategory>([
  'sales', 'purchasing', 'crm', 'inventory', 'warehouse', 'manufacturing',
  'quality', 'finance', 'assets', 'project', 'service', 'hr', 'payroll',
  'admin', 'integration', 'system',
]);

const ENTITY_KEYS: Record<string, string> = {
  app_session: 'session', app_user: 'user', master_module: 'module',
  password_reset_token: 'passwordReset', role: 'role', role_permission: 'permission',
  user_invitation: 'invitation', system: 'system',
};

export function personalActivityCategory(entity: string): PersonalActivityCategory {
  const prefix = entity.includes('/') ? entity.split('/')[0] : '';
  return CATEGORY_KEYS.has(prefix as PersonalActivityCategory)
    ? prefix as PersonalActivityCategory
    : ENTITY_KEYS[entity]
      ? 'admin'
      : 'system';
}

export function personalActivityEntityKey(entity: string): string {
  if (ENTITY_KEYS[entity]) return ENTITY_KEYS[entity];
  const leaf = entity.includes('/') ? entity.split('/').at(-1) ?? '' : '';
  return /^[a-z][a-z0-9-]*$/.test(leaf) ? leaf : 'record';
}

export function personalActivityActionKind(action: string): PersonalActivityAction {
  const normalized = action.toLowerCase().replaceAll('_', '-');
  if (normalized === 'create' || normalized === 'accept') return 'create';
  if (normalized.includes('approve') || normalized === 'activate') return 'approve';
  if (normalized.includes('reject') || normalized === 'mark-lost') return 'reject';
  if (normalized === 'post' || normalized.includes('complete') || normalized.includes('reconcile')) return 'post';
  if (normalized.includes('reverse') || normalized === 'void' || normalized.includes('cancel')) return 'reverse';
  if (['update', 'set-active', 'set-enabled', 'set-permission', 'switch-company', 'match', 'unmatch', 'allocate'].includes(normalized)) return 'update';
  return 'other';
}

export async function listPersonalActivityWithin(
  db: DB,
  scope: PersonalActivityScope,
  actorUserId: number,
  query: { limit?: number; cursor?: number } = {},
): Promise<{ data: PersonalActivityRow[]; nextCursor: number | null }> {
  if (!Number.isSafeInteger(actorUserId) || actorUserId <= 0) {
    throw new Error('actorUserId must be a positive integer.');
  }
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  const conditions = [
    eq(auditLog.masterFn, scope.masterFn),
    eq(auditLog.companyFn, scope.companyFn),
    eq(auditLog.actorUserId, actorUserId),
  ];
  if (query.cursor != null) conditions.push(lt(auditLog.id, query.cursor));
  const rows = await db.select({
    id: auditLog.id,
    entity: auditLog.entity,
    entityId: auditLog.entityId,
    action: auditLog.action,
    occurredAt: auditLog.occurredAt,
  }).from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    data: page.map((row) => ({
      id: row.id,
      category: personalActivityCategory(row.entity),
      entityKey: personalActivityEntityKey(row.entity),
      entityId: row.entityId,
      actionKind: personalActivityActionKind(row.action),
      occurredAt: row.occurredAt,
    })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}
