import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedAgentIdentity } from '../auth/agentAuthentication';

/**
 * The protocol and resource identifiers are intentionally server-owned. A
 * client may request scopes, but it cannot choose the resource audience or
 * ERP tenant represented by an authenticated token.
 */
export const MCP_PROTOCOL_VERSION = '2025-11-25' as const;
export const MCP_ENDPOINT_PATH = '/api/mcp/v1' as const;
export const MCP_RESOURCE_SCOPES = [
  'erp.receipts.read',
  'erp.receipts.prepare',
  'erp.receipts.execute',
] as const;

export type McpResourceScope = (typeof MCP_RESOURCE_SCOPES)[number];

export interface McpAuthorizationInput {
  bearerToken?: string;
  method: string;
  path: string;
  requestId: string;
  resourceUri: string;
  requiredScopes: readonly McpResourceScope[];
}

export interface McpAuthenticatedIdentity extends AuthenticatedAgentIdentity {
  scopes: readonly McpResourceScope[];
}

export interface McpAuthorizationAdapter {
  authenticate(input: McpAuthorizationInput): Promise<McpAuthenticatedIdentity | null>;
}

export interface LocalMcpFixtureToken {
  identity: McpAuthenticatedIdentity;
  expiresAt: number;
}

export interface LocalMcpAuthorizationFixture {
  adapter: McpAuthorizationAdapter;
  issue(token: string, claims: LocalMcpFixtureToken): void;
  revoke(token: string): void;
}

function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function validResourceUri(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && url.username === ''
      && url.password === ''
      && url.hash === '';
  } catch {
    return false;
  }
}

function hasRequiredScopes(
  granted: readonly McpResourceScope[],
  required: readonly McpResourceScope[],
): boolean {
  const available = new Set(granted);
  return required.every((scope) => available.has(scope));
}

/**
 * An executable in-memory issuer fixture for protocol/auth tests only.
 * Production must provide an OAuth/OIDC resource-server adapter that verifies
 * issuer signatures or introspection, audience/resource indicators, expiry and
 * revocation before returning this ERP identity contract.
 */
export function createLocalMcpAuthorizationFixture(options: {
  issuer: string;
  resourceUri: string;
}): LocalMcpAuthorizationFixture {
  if (!options.issuer.trim()) throw new Error('MCP issuer is required.');
  if (!validResourceUri(options.resourceUri)) {
    throw new Error('MCP resource URI must be an absolute HTTP(S) URI without credentials or fragments.');
  }

  const tokens = new Map<string, LocalMcpFixtureToken>();
  const revoked = new Set<string>();
  const adapter: McpAuthorizationAdapter = {
    async authenticate(input): Promise<McpAuthenticatedIdentity | null> {
      if (input.resourceUri !== options.resourceUri) return null;
      const token = input.bearerToken?.trim();
      if (!token || token.length < 16 || token.length > 512) return null;
      const digest = tokenDigest(token);
      if (revoked.has(digest)) return null;
      const record = tokens.get(digest);
      if (!record || record.expiresAt <= Math.floor(Date.now() / 1000)) return null;
      if (!hasRequiredScopes(record.identity.scopes, input.requiredScopes)) return null;
      if (record.identity.issuer !== options.issuer
        || record.identity.audience !== options.resourceUri) return null;
      return {
        ...record.identity,
        scopes: [...record.identity.scopes],
      };
    },
  };

  return {
    adapter,
    issue(token, claims) {
      if (!token || token.length < 16 || token.length > 512) {
        throw new Error('Local MCP fixture tokens must be bounded opaque values.');
      }
      if (claims.identity.issuer !== options.issuer) {
        throw new Error('Local MCP fixture issuer does not match the configured issuer.');
      }
      if (claims.identity.audience !== options.resourceUri) {
        throw new Error('Local MCP fixture audience must equal the configured resource URI.');
      }
      if (claims.expiresAt <= Math.floor(Date.now() / 1000)) {
        throw new Error('Local MCP fixture token must not be expired.');
      }
      tokens.set(tokenDigest(token), {
        identity: {
          ...claims.identity,
          scopes: [...claims.identity.scopes],
        },
        expiresAt: claims.expiresAt,
      });
    },
    revoke(token) {
      revoked.add(tokenDigest(token));
    },
  };
}

export function newLocalMcpFixtureToken(): string {
  return `mcp-fixture-${randomBytes(24).toString('base64url')}`;
}
