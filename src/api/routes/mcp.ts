import { Router } from 'express';
import type express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { DB } from '../../data/db';
import {
  MCP_ENDPOINT_PATH,
  MCP_PROTOCOL_VERSION,
  MCP_RESOURCE_SCOPES,
  type McpAuthenticatedIdentity,
  type McpAuthorizationAdapter,
  type McpResourceScope,
} from '../mcpAuthorization';
import {
  dispatchAuthenticatedAgentAction,
  type AgentActionDispatchResult,
} from '../agentActions';
import {
  listAgentActionContracts,
  type AgentActionName,
} from '../../modules/agent/actionContracts';
import { ActionDispatchError } from '../actionDispatcher';
import { runWithAuditAttribution } from '../auditContext';
import { apiError, context } from '../http';
import { AgentActionContractError } from '../../modules/agent/actionContracts';
import {
  McpRateLimiter,
  type McpRateLimitPolicy,
} from '../mcpRateLimit';

export const MCP_SERVER_NAME = 'erp-system-mcp';
export const MCP_SERVER_VERSION = '1.0.0';
export const MCP_DEFAULT_TOOL_TIMEOUT_MS = 10_000;
// Receipt Pack export embeds the governed multilingual register font and may
// carry original evidence. Keep a bounded but usable MCP response budget.
export const MCP_DEFAULT_MAX_RESULT_BYTES = 50_000_000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const READ_SCOPES = [MCP_RESOURCE_SCOPES[0]] as const;
const METADATA_PATH_PREFIX = '/.well-known/oauth-protected-resource';

export interface McpRouterOptions {
  /** External OAuth/OIDC resource-server adapter. No anonymous fallback exists. */
  authorization?: McpAuthorizationAdapter;
  /** Issuer advertised in RFC 9728 Protected Resource Metadata. */
  issuer?: string;
  /** Exact resource audience used by the issuer and MCP clients. */
  resourceUri?: string;
  /** Used to derive resourceUri when resourceUri is not explicitly provided. */
  publicUrl?: string;
  toolTimeoutMs?: number;
  maxResultBytes?: number;
  rateLimit?: McpRateLimitPolicy;
}

interface McpRequestBody {
  method?: unknown;
  params?: unknown;
}

class McpToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'McpToolError';
  }
}

function validAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && url.username === ''
      && url.password === ''
      && url.hash === '';
  } catch {
    return false;
  }
}

function resolveResourceUri(options: McpRouterOptions): string {
  const explicit = options.resourceUri?.trim();
  if (explicit) {
    if (!validAbsoluteHttpUrl(explicit)) {
      throw new Error('MCP resourceUri must be an absolute HTTP(S) URL without credentials or fragments.');
    }
    return explicit;
  }
  const publicUrl = options.publicUrl?.trim() || 'http://127.0.0.1:4173';
  if (!validAbsoluteHttpUrl(publicUrl)) {
    throw new Error('MCP publicUrl must be an absolute HTTP(S) URL without credentials or fragments.');
  }
  const base = publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`;
  const resource = new URL('api/mcp/v1', base).toString();
  if (!validAbsoluteHttpUrl(resource)) {
    throw new Error('MCP resource URI could not be derived from publicUrl.');
  }
  return resource;
}

function metadataPath(resourceUri: string): string {
  return `${METADATA_PATH_PREFIX}${new URL(resourceUri).pathname}`;
}

function metadataUrl(resourceUri: string): string {
  const resource = new URL(resourceUri);
  return new URL(metadataPath(resourceUri), resource.origin).toString();
}

function validIssuer(issuer: string | undefined): issuer is string {
  return Boolean(issuer && issuer.trim() && validAbsoluteHttpUrl(issuer.trim()));
}

function bearerToken(req: express.Request): string | undefined {
  const value = req.header('authorization');
  if (!value?.startsWith('Bearer ')) return undefined;
  const token = value.slice('Bearer '.length).trim();
  return token || undefined;
}

function isRequestBody(value: unknown): value is McpRequestBody {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toolNameFromBody(body: unknown): string | undefined {
  if (!isRequestBody(body) || body.method !== 'tools/call') return undefined;
  if (!body.params || typeof body.params !== 'object' || Array.isArray(body.params)) return undefined;
  const name = (body.params as { name?: unknown }).name;
  return typeof name === 'string' ? name : undefined;
}

function requiredScopesForRequest(body: unknown): readonly McpResourceScope[] {
  const messages = Array.isArray(body) ? body : [body];
  const scopes = new Set<McpResourceScope>(READ_SCOPES);
  for (const message of messages) {
    const name = toolNameFromBody(message);
    if (name === 'receipt_pack.prepare') scopes.add(MCP_RESOURCE_SCOPES[1]);
    if (name === 'receipt_pack.create') scopes.add(MCP_RESOURCE_SCOPES[2]);
  }
  return MCP_RESOURCE_SCOPES.filter((scope) => scopes.has(scope));
}

function validIdentity(
  value: McpAuthenticatedIdentity,
  resourceUri: string,
  issuer: string,
): boolean {
  return Number.isSafeInteger(value.agentPrincipalId)
    && value.agentPrincipalId > 0
    && Boolean(value.masterFn?.trim())
    && Boolean(value.companyFn?.trim())
    && value.issuer === issuer
    && value.audience === resourceUri
    && Boolean(value.subject?.trim())
    && Array.isArray(value.scopes)
    && value.scopes.every((scope) => MCP_RESOURCE_SCOPES.includes(scope));
}

function hasRequiredScopes(
  granted: readonly McpResourceScope[],
  required: readonly McpResourceScope[],
): boolean {
  const available = new Set(granted);
  return required.every((scope) => available.has(scope));
}

function toolInputSchema(action: AgentActionName) {
  const id = z.number().int().positive();
  const date = z.string().regex(DATE_PATTERN);
  const locale = z.enum(['en', 'ms', 'zh', 'ja', 'vi']);
  switch (action) {
    case 'receipt.search':
      return z.object({
        limit: z.number().int().min(1).max(100).optional(),
        afterId: id.optional(),
        search: z.string().max(200).optional(),
        dateFrom: date.optional(),
        dateTo: date.optional(),
      }).strict();
    case 'receipt.get':
      return z.object({ receiptId: id }).strict();
    case 'receipt_pack.prepare':
      return z.object({
        search: z.string().max(200).optional(),
        dateFrom: date,
        dateTo: date,
        locale: locale.optional(),
      }).strict();
    case 'receipt_pack.create':
      return z.object({
        packKey: z.string().min(8).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
        search: z.string().max(200).optional(),
        dateFrom: date,
        dateTo: date,
        locale: locale.optional(),
        executionIntentId: id.optional(),
        executionIntentKey: z.string().min(16).max(200).optional(),
        selectionDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
        payloadDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
      }).strict();
    case 'receipt_pack.get':
      return z.object({ packId: id }).strict();
    case 'receipt_pack.export':
      return z.object({
        packId: id,
        action: z.enum(['view', 'download', 'print']),
      }).strict();
  }
}

function errorPayload(error: unknown): { code: string; message: string } {
  if (error instanceof McpToolError) return { code: error.code, message: error.message };
  if (error instanceof ActionDispatchError) return { code: error.code, message: error.message };
  if (error instanceof AgentActionContractError) return { code: error.code, message: error.message };
  return { code: 'mcp_tool_failed', message: 'The MCP tool could not complete.' };
}

function errorResult(error: unknown) {
  const payload = { error: errorPayload(error) };
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new McpToolError(
          'mcp_tool_timeout',
          'The MCP tool exceeded its execution time limit.',
        )), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function resultEnvelope(result: AgentActionDispatchResult): {
  action: string;
  version: number;
  body: unknown;
} {
  if (result.kind === 'json') {
    return { action: result.action, version: result.version, body: result.body };
  }
  return { action: result.action, version: result.version, body: result.metadata };
}

function resultByteLength(result: AgentActionDispatchResult, envelope: unknown): number {
  const jsonLength = Buffer.byteLength(JSON.stringify(envelope), 'utf8');
  return jsonLength + (result.kind === 'binary' ? Math.ceil(result.content.byteLength * 4 / 3) : 0);
}

function resultContent(result: AgentActionDispatchResult, envelope: unknown) {
  const content: CallToolResult['content'] = [{
    type: 'text',
    text: JSON.stringify(envelope),
  }];
  if (result.kind === 'binary') {
    content.push({
      type: 'resource',
      resource: {
        uri: `urn:erp-system:receipt-pack:${result.metadata.artifactSha256}`,
        mimeType: result.contentType,
        blob: Buffer.from(result.content).toString('base64'),
      },
    });
  }
  return content;
}

function createMcpServer(
  db: DB,
  identity: McpAuthenticatedIdentity,
  requestId: string,
  options: { toolTimeoutMs: number; maxResultBytes: number },
): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } },
  );
  for (const contract of listAgentActionContracts()) {
    const action = contract.name;
    server.registerTool(action, {
      title: action,
      description: contract.description,
      inputSchema: toolInputSchema(action),
      outputSchema: z.object({
        action: z.string(),
        version: z.number().int(),
        body: z.unknown(),
      }),
    }, async (input: unknown) => {
      try {
        const result = await withTimeout(
          runWithAuditAttribution({ agentPrincipalId: identity.agentPrincipalId }, () =>
            dispatchAuthenticatedAgentAction(db, {
              identity,
              action,
              input,
              requestId,
            })),
          options.toolTimeoutMs,
        );
        const envelope = resultEnvelope(result);
        if (resultByteLength(result, envelope) > options.maxResultBytes) {
          throw new McpToolError(
            'mcp_result_too_large',
            'The MCP tool result exceeded the configured response size limit.',
          );
        }
        return {
          structuredContent: envelope,
          content: resultContent(result, envelope),
        };
      } catch (error) {
        return errorResult(error);
      }
    });
  }
  return server;
}

function unauthorized(
  res: express.Response,
  resourceMetadataUrl: string,
  requiredScopes: readonly McpResourceScope[],
): void {
  const scope = requiredScopes.join(' ');
  res.setHeader(
    'WWW-Authenticate',
    `Bearer resource_metadata="${resourceMetadataUrl}", scope="${scope}"`,
  );
  apiError(res, 401, 'mcp_not_authenticated', 'A valid MCP bearer credential is required.');
}

export function createMcpRouter(db: DB, options: McpRouterOptions = {}): Router {
  const router = Router();
  const rateLimiter = new McpRateLimiter(options.rateLimit);
  const resourceUri = resolveResourceUri(options);
  const resourceMetadataPath = metadataPath(resourceUri);
  const resourceMetadataUrl = metadataUrl(resourceUri);
  const issuer = options.issuer?.trim();
  const toolTimeoutMs = Math.max(1, Math.min(
    Math.floor(options.toolTimeoutMs ?? MCP_DEFAULT_TOOL_TIMEOUT_MS),
    60_000,
  ));
  const maxResultBytes = Math.max(1_024, Math.min(
    Math.floor(options.maxResultBytes ?? MCP_DEFAULT_MAX_RESULT_BYTES),
    100_000_000,
  ));

  const metadataHandler = (_req: express.Request, res: express.Response): void => {
    if (!validIssuer(issuer)) {
      apiError(res, 503, 'mcp_not_configured', 'MCP OAuth/OIDC issuer metadata is not configured.');
      return;
    }
    res.json({
      resource: resourceUri,
      authorization_servers: [issuer],
      scopes_supported: [...MCP_RESOURCE_SCOPES],
      resource_name: 'ERP Company Receipts',
    });
  };
  router.get(resourceMetadataPath, metadataHandler);
  // Keep the RFC 9728 root form available for clients that do not use the
  // path-aware well-known lookup while retaining the path-specific resource.
  router.get(METADATA_PATH_PREFIX, metadataHandler);

  router.all(MCP_ENDPOINT_PATH, async (req, res) => {
    if (!options.authorization || !validIssuer(issuer)) {
      apiError(res, 503, 'mcp_not_configured', 'MCP authorization is not configured.');
      return;
    }
    const rateLimit = rateLimiter.check(
      `${req.ip}\0${bearerToken(req) ?? 'anonymous'}`,
    );
    res.setHeader('RateLimit-Limit', String(rateLimit.limit));
    res.setHeader('RateLimit-Remaining', String(rateLimit.remaining));
    res.setHeader(
      'RateLimit-Reset',
      String(Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000))),
    );
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      apiError(res, 429, 'mcp_rate_limited', 'MCP request rate limit exceeded.');
      return;
    }
    const requiredScopes = requiredScopesForRequest(req.body);
    let identity: McpAuthenticatedIdentity | null;
    try {
      identity = await options.authorization.authenticate({
        bearerToken: bearerToken(req),
        method: req.method,
        path: MCP_ENDPOINT_PATH,
        requestId: context(res).requestId,
        resourceUri,
        requiredScopes,
      });
    } catch {
      identity = null;
    }
    if (
      !identity
      || !validIdentity(identity, resourceUri, issuer)
      || !hasRequiredScopes(identity.scopes, requiredScopes)
    ) {
      unauthorized(res, resourceMetadataUrl, requiredScopes);
      return;
    }

    const server = createMcpServer(db, identity, context(res).requestId, {
      toolTimeoutMs,
      maxResultBytes,
    });
    const transport = new StreamableHTTPServerTransport({
      // Stateless mode keeps issuer authentication request-scoped. A session
      // established by initialize must never pin a stale tenant identity.
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        apiError(res, 500, 'mcp_transport_failed', 'The MCP transport could not complete the request.');
      } else {
        console.error('[erp-system-mcp] transport failed', error);
      }
    } finally {
      await server.close().catch((error: unknown) => {
        console.error('[erp-system-mcp] server close failed', error);
      });
    }
  });

  return router;
}

// Kept exported for focused route tests and future client adapters.
export { MCP_PROTOCOL_VERSION };
