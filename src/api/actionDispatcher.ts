import type { DB } from '../data/db';
import { withTenantTransaction } from '../data/tenantTransaction';
import { hasAnyPermission } from '../auth/permissions';
import { fineGrainedActionPermission } from '../auth/accessCatalog';
import type { SessionData } from '../auth/session';
import { appendAudit } from './audit';
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
} from './idempotency';

export class ActionDispatchError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface ActionExecutionContext {
  db: DB;
  session: SessionData;
  resource: string;
  resourceId: number;
  action: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  requestId: string;
}

export interface ActionDefinition {
  permission: string;
  idempotency: 'required' | 'optional';
  audit: 'required' | 'none';
  execute(
    tx: DB,
    scope: { masterFn: string; companyFn: string },
    input: { resourceId: number; payload: Record<string, unknown>; actorUserId: number },
  ): Promise<unknown>;
}

export interface ActionDispatchResult {
  status: number;
  body: unknown;
  replayed: boolean;
}

export async function dispatchAction(
  context: ActionExecutionContext,
  definition: ActionDefinition,
): Promise<ActionDispatchResult> {
  const key = context.idempotencyKey?.trim();
  if (definition.idempotency === 'required' && !key) {
    throw new ActionDispatchError(
      428,
      'idempotency_key_required',
      'Idempotency-Key is required for this action.',
    );
  }
  if (key && key.length > 200) {
    throw new ActionDispatchError(400, 'idempotency_key_invalid', 'Idempotency-Key is too long.');
  }
  if ('masterFn' in context.payload || 'companyFn' in context.payload) {
    throw new ActionDispatchError(
      400,
      'tenant_override_rejected',
      'Tenant scope comes from the authenticated session.',
    );
  }
  const scope = {
    masterFn: context.session.masterFn,
    companyFn: context.session.activeCompanyFn,
  };
  return withTenantTransaction(context.db, scope, async (tx) => {
    if (!await hasAnyPermission(tx, context.session, [
      fineGrainedActionPermission(context.resource, context.action),
      definition.permission,
    ])) {
      throw new ActionDispatchError(403, 'permission_denied', 'You cannot perform this action.');
    }
    const operation = `${context.resource}:${context.resourceId}:${context.action}`;
    let claimId: number | null = null;
    if (key) {
      const claim = await beginIdempotentRequest(tx, {
        ...scope,
        actorUserId: context.session.userId,
      }, key, operation, context.payload);
      if (claim.kind === 'replay') {
        return { status: claim.status, body: claim.body, replayed: true };
      }
      if (claim.kind === 'conflict') {
        throw new ActionDispatchError(
          409,
          claim.reason === 'different_request'
            ? 'idempotency_key_reused'
            : 'idempotency_request_in_progress',
          claim.reason === 'different_request'
            ? 'This Idempotency-Key was already used for a different request.'
            : 'An identical request is already in progress.',
        );
      }
      claimId = claim.recordId;
    }

    const result = await definition.execute(tx, scope, {
      resourceId: context.resourceId,
      payload: context.payload,
      actorUserId: context.session.userId,
    });
    const body = { data: result, meta: {} };
    if (definition.audit === 'required') {
      await appendAudit(tx, {
        masterFn: scope.masterFn,
        companyFn: scope.companyFn,
        actorUserId: context.session.userId,
        requestId: context.requestId,
        entity: context.resource,
        entityId: context.resourceId,
        action: context.action,
        after: result,
      });
    }
    if (claimId != null) {
      await completeIdempotentRequest(tx, claimId, 200, body);
    }
    return { status: 200, body, replayed: false };
  });
}
