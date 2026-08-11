import {
  and, desc, eq, isNull, lt, sql,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { hasAnyPermission, type PermissionKey } from '../../auth/permissions';
import { isModuleEnabled } from '../../auth/moduleAccess';
import type { SessionData } from '../../auth/session';
import { appNotification, appUser, employee, userCompany } from '../../data/schema';

export const NOTIFICATION_KINDS = [
  'approval_required',
  'inventory_attention',
  'quality_attention',
  'finance_attention',
  'sales_attention',
  'integration_completed',
  'system_notice',
] as const;
export type NotificationKind = typeof NOTIFICATION_KINDS[number];

export const NOTIFICATION_SEVERITIES = ['info', 'success', 'warning', 'critical'] as const;
export type NotificationSeverity = typeof NOTIFICATION_SEVERITIES[number];
export type NotificationCategory =
  | 'approval' | 'inventory' | 'quality' | 'finance' | 'sales' | 'integration' | 'system';

export interface DeliverNotificationInput {
  kind: NotificationKind;
  severity?: NotificationSeverity;
  subject: string;
  detail: string;
  route?: string | null;
  entityRef?: string | null;
}

export interface NotificationRow {
  id: number;
  kind: NotificationKind;
  category: NotificationCategory;
  severity: NotificationSeverity;
  subject: string;
  detail: string;
  route: string | null;
  entityRef: string | null;
  deliveredAt: Date;
  readAt: Date | null;
  dismissedAt: Date | null;
  version: number;
}

export class NotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationError';
  }
}

const KIND_SET = new Set<string>(NOTIFICATION_KINDS);
const SEVERITY_SET = new Set<string>(NOTIFICATION_SEVERITIES);

/**
 * Notification destinations are an application-owned contract, not arbitrary
 * client navigation strings. Every destination must describe the permission
 * and (where applicable) tenant module required by the API that the screen
 * will call. Keep this registry small and add a route only when its drill-in
 * API has a matching access contract.
 */
interface NotificationDestinationDefinition {
  permissions: readonly PermissionKey[];
  module?: string;
  employeeSelf?: boolean;
}

const NOTIFICATION_DESTINATIONS: Record<string, NotificationDestinationDefinition> = {
  dashboard: { permissions: ['dashboard.read'] },
  'purchase-orders': { permissions: ['purchasing.read'], module: 'purchasing' },
  'stock-on-hand': { permissions: ['inventory.read'], module: 'inventory' },
  quotations: { permissions: ['sales.read'], module: 'sales' },
  'data-import': { permissions: ['integration.read'], module: 'integration' },
  'qc-inspection': { permissions: ['quality.read'], module: 'quality' },
  'staff-calendar': { permissions: ['hr.read'], module: 'hr' },
  'leave-approval': { permissions: ['hr.read'], module: 'hr' },
  'my-approvals': { permissions: ['employee.self.read'], employeeSelf: true },
} as const;

export const NOTIFICATION_DESTINATION_ROUTES = Object.freeze(
  Object.keys(NOTIFICATION_DESTINATIONS),
);

type NotificationDestinationRoute = keyof typeof NOTIFICATION_DESTINATIONS;

function recipientSession(
  recipientUserId: number,
  scope: Scope,
): SessionData {
  return {
    userId: recipientUserId,
    masterFn: scope.masterFn,
    activeCompanyFn: scope.companyFn,
    username: '',
    email: null,
    fullName: null,
  };
}

async function linkedEmployeeWithin(
  exec: DB,
  scope: Scope,
  recipientUserId: number,
): Promise<boolean> {
  const [linked] = await exec.select({ id: employee.id }).from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.userId, recipientUserId),
    eq(employee.isActive, true),
  )).limit(1);
  return Boolean(linked);
}

async function destinationAccessibleWithin(
  exec: DB,
  scope: Scope,
  recipientUserId: number,
  session: SessionData,
  route: NotificationDestinationRoute,
): Promise<boolean> {
  const destination = NOTIFICATION_DESTINATIONS[route];
  if (destination.module && !await isModuleEnabled(
    exec,
    scope.masterFn,
    scope.companyFn,
    destination.module,
  )) return false;
  if (!await hasAnyPermission(exec, session, destination.permissions)) return false;
  if (destination.employeeSelf && !await linkedEmployeeWithin(exec, scope, recipientUserId)) {
    return false;
  }
  return true;
}

/**
 * Resolve a stored destination to the route this recipient can actually open.
 * The two approval routes are intentionally compatible: older rows may have
 * been stored as `my-approvals` for an HR authority or as `leave-approval` for
 * a manager. We preserve the row but return the valid current destination.
 */
export async function resolveNotificationDestinationWithin(
  exec: DB,
  scope: Scope,
  recipientUserId: number,
  route: string | null,
  session = recipientSession(recipientUserId, scope),
): Promise<string | null> {
  const raw = String(route ?? '').trim();
  if (!raw || !(raw in NOTIFICATION_DESTINATIONS)) return null;

  const canOpen = (candidate: NotificationDestinationRoute) =>
    destinationAccessibleWithin(exec, scope, recipientUserId, session, candidate);

  if (raw === 'my-approvals') {
    if (await canOpen('my-approvals')) return 'my-approvals';
    if (await canOpen('leave-approval')) return 'leave-approval';
    return null;
  }
  if (raw === 'leave-approval') {
    if (await canOpen('leave-approval')) return 'leave-approval';
    if (await canOpen('my-approvals')) return 'my-approvals';
    return null;
  }
  return await canOpen(raw as NotificationDestinationRoute) ? raw : null;
}

export function notificationCategory(kind: NotificationKind): NotificationCategory {
  if (kind === 'approval_required') return 'approval';
  if (kind === 'inventory_attention') return 'inventory';
  if (kind === 'quality_attention') return 'quality';
  if (kind === 'finance_attention') return 'finance';
  if (kind === 'sales_attention') return 'sales';
  if (kind === 'integration_completed') return 'integration';
  return 'system';
}

function cleanText(value: unknown, label: string, maximum: number): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new NotificationError(`${label} is required.`);
  if (normalized.length > maximum) {
    throw new NotificationError(`${label} must be ${maximum} characters or fewer.`);
  }
  return normalized;
}

function cleanOptionalText(value: unknown, label: string, maximum: number): string | null {
  if (value == null || value === '') return null;
  return cleanText(value, label, maximum);
}

function publicRow(row: {
  id: number;
  kind: string;
  severity: string;
  subject: string;
  detail: string;
  route: string | null;
  entityRef: string | null;
  deliveredAt: Date;
  readAt: Date | null;
  dismissedAt: Date | null;
  version: number;
}): NotificationRow {
  const kind = row.kind as NotificationKind;
  return {
    id: row.id,
    kind,
    category: notificationCategory(kind),
    severity: row.severity as NotificationSeverity,
    subject: row.subject,
    detail: row.detail,
    route: row.route,
    entityRef: row.entityRef,
    deliveredAt: row.deliveredAt,
    readAt: row.readAt,
    dismissedAt: row.dismissedAt,
    version: row.version,
  };
}

const PUBLIC_COLUMNS = {
  id: appNotification.id,
  kind: appNotification.kind,
  severity: appNotification.severity,
  subject: appNotification.subject,
  detail: appNotification.detail,
  route: appNotification.route,
  entityRef: appNotification.entityRef,
  deliveredAt: appNotification.deliveredAt,
  readAt: appNotification.readAt,
  dismissedAt: appNotification.dismissedAt,
  version: appNotification.version,
};

export async function deliverNotificationWithin(
  exec: DB,
  scope: Scope,
  recipientUserId: number,
  input: DeliverNotificationInput,
  now = new Date(),
): Promise<NotificationRow> {
  if (!Number.isSafeInteger(recipientUserId) || recipientUserId <= 0) {
    throw new NotificationError('recipientUserId must be a positive integer.');
  }
  if (!KIND_SET.has(String(input.kind))) throw new NotificationError('kind is unsupported.');
  const severity = String(input.severity ?? 'info');
  if (!SEVERITY_SET.has(severity)) throw new NotificationError('severity is unsupported.');
  const subject = cleanText(input.subject, 'subject', 160);
  const detail = cleanText(input.detail, 'detail', 500);
  const route = cleanOptionalText(input.route, 'route', 64);
  if (route && !/^[a-z][a-z0-9-]{0,63}$/.test(route)) {
    throw new NotificationError('route must be a registered-style route key.');
  }
  if (route && !(route in NOTIFICATION_DESTINATIONS)) {
    throw new NotificationError(`route '${route}' is not a registered notification destination.`);
  }
  const entityRef = cleanOptionalText(input.entityRef, 'entityRef', 80);

  const [recipient] = await exec.select({ id: appUser.userId }).from(appUser)
    .innerJoin(userCompany, eq(userCompany.userId, appUser.userId))
    .where(and(
      eq(appUser.userId, recipientUserId),
      eq(appUser.masterFn, scope.masterFn),
      eq(appUser.isActive, true),
      eq(userCompany.companyFn, scope.companyFn),
    )).limit(1);
  if (!recipient) throw new NotificationError('The notification recipient is unavailable in this company.');

  const [created] = await exec.insert(appNotification).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    recipientUserId,
    kind: input.kind,
    severity,
    subject,
    detail,
    route,
    entityRef,
    deliveredAt: now,
  }).returning(PUBLIC_COLUMNS);
  return publicRow(created);
}

export async function listNotificationsWithin(
  exec: DB,
  scope: Scope,
  recipientUserId: number,
  input: { cursor?: number; limit?: number } = {},
): Promise<{ data: NotificationRow[]; nextCursor: number | null }> {
  if (!Number.isSafeInteger(recipientUserId) || recipientUserId <= 0) {
    throw new NotificationError('An authenticated notification recipient is required.');
  }
  const cursor = Number.isSafeInteger(input.cursor) && Number(input.cursor) > 0
    ? Number(input.cursor)
    : null;
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
  const session = recipientSession(recipientUserId, scope);
  const destinationCache = new Map<string, Promise<string | null>>();
  const visible: NotificationRow[] = [];
  let scanCursor = cursor;
  let exhausted = false;
  let lastScannedId: number | null = null;

  /* Filter before returning a page. This prevents an inaccessible notification
     from appearing in the bell/full feed and avoids a click that can only end
     in a 403. Continue scanning when a page contains hidden rows so pagination
     still returns the requested number of usable notifications. */
  while (visible.length < limit && !exhausted) {
    const predicates = [
      eq(appNotification.masterFn, scope.masterFn),
      eq(appNotification.companyFn, scope.companyFn),
      eq(appNotification.recipientUserId, recipientUserId),
      isNull(appNotification.dismissedAt),
    ];
    if (scanCursor != null) predicates.push(lt(appNotification.id, scanCursor));
    const rows = await exec.select(PUBLIC_COLUMNS).from(appNotification)
      .where(and(...predicates))
      .orderBy(desc(appNotification.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    lastScannedId = page.at(-1)?.id ?? lastScannedId;
    let returnedLimitAt: number | null = null;
    let rowsAfterReturnedLimit = false;
    for (const row of page) {
      if (visible.length >= limit) {
        rowsAfterReturnedLimit = true;
        continue;
      }
      let resolvedRoute: string | null = row.route;
      if (row.route) {
        const key = row.route.trim();
        let pending = destinationCache.get(key);
        if (!pending) {
          pending = resolveNotificationDestinationWithin(
            exec,
            scope,
            recipientUserId,
            key,
            session,
          );
          destinationCache.set(key, pending);
        }
        resolvedRoute = await pending;
        if (!resolvedRoute) continue;
      }
      visible.push(publicRow({ ...row, route: resolvedRoute }));
      if (visible.length >= limit) returnedLimitAt = row.id;
    }
    if (returnedLimitAt != null) {
      lastScannedId = returnedLimitAt;
      exhausted = !rowsAfterReturnedLimit && !hasMore;
      if (!exhausted) break;
    }
    exhausted = !hasMore;
    scanCursor = lastScannedId;
  }
  return {
    data: visible,
    nextCursor: exhausted ? null : lastScannedId,
  };
}

async function requireOwnedNotification(
  exec: DB,
  scope: Scope,
  recipientUserId: number,
  notificationId: number,
) {
  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
    throw new NotificationError('notificationId must be a positive integer.');
  }
  const [row] = await exec.select(PUBLIC_COLUMNS).from(appNotification).where(and(
    eq(appNotification.masterFn, scope.masterFn),
    eq(appNotification.companyFn, scope.companyFn),
    eq(appNotification.recipientUserId, recipientUserId),
    eq(appNotification.id, notificationId),
  )).for('update');
  if (!row) throw new NotificationError('Notification is unavailable for this user.');
  return row;
}

export async function markNotificationReadWithin(
  exec: DB,
  scope: Scope,
  recipientUserId: number,
  notificationId: number,
  now = new Date(),
): Promise<NotificationRow> {
  const existing = await requireOwnedNotification(exec, scope, recipientUserId, notificationId);
  if (existing.readAt) return publicRow(existing);
  const [updated] = await exec.update(appNotification).set({
    readAt: now,
    updatedAt: now,
    version: sql`${appNotification.version} + 1`,
  }).where(and(
    eq(appNotification.masterFn, scope.masterFn),
    eq(appNotification.companyFn, scope.companyFn),
    eq(appNotification.recipientUserId, recipientUserId),
    eq(appNotification.id, notificationId),
    isNull(appNotification.readAt),
  )).returning(PUBLIC_COLUMNS);
  if (!updated) throw new NotificationError('Notification changed before it could be marked read.');
  return publicRow(updated);
}

export async function dismissNotificationWithin(
  exec: DB,
  scope: Scope,
  recipientUserId: number,
  notificationId: number,
  now = new Date(),
): Promise<NotificationRow> {
  const existing = await requireOwnedNotification(exec, scope, recipientUserId, notificationId);
  if (existing.dismissedAt) return publicRow(existing);
  const [updated] = await exec.update(appNotification).set({
    readAt: existing.readAt ?? now,
    dismissedAt: now,
    updatedAt: now,
    version: sql`${appNotification.version} + 1`,
  }).where(and(
    eq(appNotification.masterFn, scope.masterFn),
    eq(appNotification.companyFn, scope.companyFn),
    eq(appNotification.recipientUserId, recipientUserId),
    eq(appNotification.id, notificationId),
    isNull(appNotification.dismissedAt),
  )).returning(PUBLIC_COLUMNS);
  if (!updated) throw new NotificationError('Notification changed before it could be dismissed.');
  return publicRow(updated);
}
