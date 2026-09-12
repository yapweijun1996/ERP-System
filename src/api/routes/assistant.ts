import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type express from 'express';
import type { DB } from '../../data/db';
import { requireSession, apiError, context } from '../http';
import {
  decideReceiptAssistantIntent,
  executeReceiptAssistantPack,
  ReceiptAssistantError,
  resolveReceiptAssistantIdentity,
  runReceiptAssistant,
  type ReceiptAssistantDecisionInput,
  type ReceiptAssistantExecutionInput,
  type ReceiptAssistantProviderFactory,
} from '../receiptAssistant';
import {
  DEFAULT_DETERMINISTIC_RUNTIME_LIMITS,
  type AiRuntimeLimits,
} from '../../modules/agent/aiRuntime';
import { AgentActionContractError } from '../../modules/agent/actionContracts';
import { ActionDispatchError } from '../actionDispatcher';

export interface ReceiptAssistantRouterOptions {
  /** A server-owned provider adapter. It is intentionally absent by default. */
  providerFactory?: ReceiptAssistantProviderFactory;
  /** Limits are deployment-owned; the browser cannot override them. */
  limits?: AiRuntimeLimits;
  /** Optional server-side Agent principal key used for governed Pack execution. */
  agentPrincipalKey?: string;
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ReceiptAssistantError(400, 'assistant_input_invalid', `${field} must be a positive integer.`);
  }
  return parsed;
}

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReceiptAssistantError(400, 'assistant_input_invalid', 'The assistant request body is invalid.');
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(body).find((key) => !allowedSet.has(key));
  if (unknown) {
    throw new ReceiptAssistantError(
      400,
      'assistant_input_invalid',
      `The assistant request field ${unknown} is not accepted by this endpoint.`,
    );
  }
}

function decisionInput(body: Record<string, unknown>): ReceiptAssistantDecisionInput {
  rejectUnknownKeys(body, ['intentId', 'expectedVersion', 'reason']);
  if (typeof body.reason !== 'string' || body.reason.trim().length < 3) {
    throw new ReceiptAssistantError(
      400,
      'assistant_input_invalid',
      'A human confirmation reason of at least 3 characters is required.',
    );
  }
  return {
    intentId: positiveInteger(body.intentId, 'intentId'),
    expectedVersion: positiveInteger(body.expectedVersion, 'expectedVersion'),
    reason: body.reason.trim(),
  };
}

function executionInput(body: Record<string, unknown>): ReceiptAssistantExecutionInput {
  rejectUnknownKeys(body, [
    'packKey', 'search', 'dateFrom', 'dateTo', 'locale',
    'executionIntentId', 'executionIntentKey', 'selectionDigest', 'payloadDigest',
  ]);
  return body as unknown as ReceiptAssistantExecutionInput;
}

function handleAssistantError(res: express.Response, error: unknown): boolean {
  if (error instanceof ReceiptAssistantError) {
    apiError(res, error.status, error.code, error.message);
    return true;
  }
  if (error instanceof ActionDispatchError) {
    apiError(res, error.status, error.code, error.message);
    return true;
  }
  if (error instanceof AgentActionContractError) {
    apiError(res, 400, error.code, error.message);
    return true;
  }
  return false;
}

/**
 * Human-session adapter for the server-owned Receipt assistant. The route only
 * carries a bounded user message or an exact confirmation payload; all tenant,
 * actor, Agent grant and approval authority is resolved on the server.
 */
export function createAssistantRouter(
  db: DB,
  options: ReceiptAssistantRouterOptions = {},
): Router {
  const router = Router();
  const limits = options.limits ?? DEFAULT_DETERMINISTIC_RUNTIME_LIMITS;

  router.post('/receipts', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const controller = new AbortController();
    const abort = () => controller.abort();
    const onClose = () => {
      if (!res.writableEnded) abort();
    };
    req.once('aborted', abort);
    res.once('close', onClose);
    try {
      if (req.aborted || res.destroyed) return;
      const body = bodyRecord(req.body);
      rejectUnknownKeys(body, ['message']);
      if (typeof body.message !== 'string') {
        throw new ReceiptAssistantError(400, 'assistant_message_invalid', 'message is required.');
      }
      if (!options.providerFactory) {
        apiError(
          res,
          503,
          'assistant_provider_unavailable',
          'No approved server AI provider is configured for the Receipt assistant.',
        );
        return;
      }
      const runId = `assistant-${randomUUID()}`;
      const agentIdentity = await resolveReceiptAssistantIdentity(
        db,
        session,
        options.agentPrincipalKey,
      );
      if (controller.signal.aborted) return;
      const resolvedProvider = await options.providerFactory({
        db,
        session,
        requestId: context(res).requestId,
        runId,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const result = await runReceiptAssistant(db, {
        runId,
        requestId: context(res).requestId,
        message: body.message,
        session,
        provider: 'limits' in resolvedProvider ? resolvedProvider.provider : resolvedProvider,
        limits: 'limits' in resolvedProvider ? resolvedProvider.limits : limits,
        agentIdentity,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      res.status(result.state === 'failed' ? 422 : 200).json({
        data: result,
        meta: {
          tenantScope: 'session_derived',
          confirmationIsSeparate: true,
          authoritativeCompletionRequiresVerification: true,
        },
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!handleAssistantError(res, error)) throw error;
    } finally {
      req.off('aborted', abort);
      res.off('close', onClose);
    }
  });

  async function requireConfiguredIdentity(req: express.Request, res: express.Response) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (!options.agentPrincipalKey) {
      apiError(
        res,
        503,
        'assistant_agent_unavailable',
        'A server-selected assistant Agent identity is required for governed Pack execution.',
      );
      return null;
    }
    const identity = await resolveReceiptAssistantIdentity(db, session, options.agentPrincipalKey);
    if (!identity) {
      apiError(
        res,
        503,
        'assistant_agent_unavailable',
        'The configured assistant Agent identity is unavailable for this Company and user.',
      );
      return null;
    }
    return { session, identity };
  }

  router.post('/receipts/actions/execute', async (req, res) => {
    const access = await requireConfiguredIdentity(req, res);
    if (!access) return;
    try {
      const result = await executeReceiptAssistantPack(
        db,
        access.session,
        access.identity,
        executionInput(bodyRecord(req.body)),
        context(res).requestId,
      );
      res.json({
        data: result,
        meta: {
          governedExecutor: true,
          persistedPackReadBack: true,
          artifactHashVerified: true,
        },
      });
    } catch (error) {
      if (!handleAssistantError(res, error)) throw error;
    }
  });

  router.post('/receipts/actions/:decision', async (req, res) => {
    const decision = req.params.decision;
    if (decision !== 'approve' && decision !== 'reject' && decision !== 'cancel') {
      apiError(res, 404, 'route_not_found', 'Assistant decision route not found.');
      return;
    }
    const access = await requireConfiguredIdentity(req, res);
    if (!access) return;
    try {
      const result = await decideReceiptAssistantIntent(
        db,
        access.session,
        access.identity,
        decisionInput(bodyRecord(req.body)),
        decision,
      );
      res.json({ data: result, meta: { humanDecision: decision } });
    } catch (error) {
      if (!handleAssistantError(res, error)) throw error;
    }
  });

  return router;
}
