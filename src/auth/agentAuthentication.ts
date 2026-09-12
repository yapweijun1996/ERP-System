import type express from 'express';
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import type { DB } from '../data/db';
import { agentCredential, agentPrincipal } from '../data/schema';
import { hashOpaqueToken } from './tokenCrypto';

/**
 * Identity returned by an independently authenticated Agent issuer.
 *
 * The issuer owns credential verification (signature, audience, expiry and
 * revocation). ERP authorization does not trust a request body or issuer claim
 * by itself; the Agent principal and tenant are rechecked against ERP state in
 * the same tenant transaction before any action is dispatched.
 */
export interface AuthenticatedAgentIdentity {
  agentPrincipalId: number;
  masterFn: string;
  companyFn: string;
  issuer: string;
  audience: string;
  subject: string;
}

export interface AgentCredentialAuthenticationInput {
  bearerToken?: string;
  requestId: string;
  method: string;
  path: string;
}

/**
 * Adapter boundary for a real issuer or a bounded local test fixture. The
 * request body is deliberately absent so client payloads cannot select an
 * actor, owner or tenant. Returning null means the credential was not
 * authenticated by the issuer.
 */
export interface AgentCredentialAuthenticator {
  authenticate(
    input: AgentCredentialAuthenticationInput,
  ): Promise<AuthenticatedAgentIdentity | null>;
}

/**
 * Local issuer adapter used when the deployment has no external issuer. It
 * stores only a SHA-256 token hash and returns the same issuer-separated
 * identity contract as an external adapter. Business authorization still
 * rechecks the principal, owner and grant after this lookup.
 */
export function createDatabaseAgentCredentialAuthenticator(db: DB): AgentCredentialAuthenticator {
  return {
    async authenticate(input): Promise<AuthenticatedAgentIdentity | null> {
      const token = input.bearerToken?.trim();
      if (!token || token.length < 32 || token.length > 512) return null;
      const now = new Date();
      return db.transaction(async (tx) => {
        // Credential lookup is the issuer boundary: the bearer hash selects
        // the tenant, so no tenant setting exists yet. The PostgreSQL RLS
        // policy permits this flag only for the two issuer lookup tables and
        // only for this transaction; business authorization follows in the
        // tenant-scoped Agent action transaction.
        await tx.execute(sql`select set_config('app.agent_issuer', 'on', true)`);
        const [row] = await tx.select({
          credentialId: agentCredential.id,
          agentPrincipalId: agentCredential.agentPrincipalId,
          masterFn: agentCredential.masterFn,
          companyFn: agentCredential.companyFn,
          principalKey: agentPrincipal.principalKey,
        }).from(agentCredential)
          .innerJoin(agentPrincipal, and(
            eq(agentPrincipal.id, agentCredential.agentPrincipalId),
            eq(agentPrincipal.masterFn, agentCredential.masterFn),
            eq(agentPrincipal.companyFn, agentCredential.companyFn),
          ))
          .where(and(
            eq(agentCredential.tokenHash, hashOpaqueToken(token)),
            eq(agentCredential.status, 'active'),
            isNull(agentCredential.revokedAt),
            lte(agentCredential.validFrom, now),
            or(isNull(agentCredential.validUntil), gt(agentCredential.validUntil, now)),
          ))
          .limit(1);
        if (!row) return null;
        await tx.update(agentCredential).set({ lastUsedAt: now, updatedAt: now })
          .where(eq(agentCredential.id, row.credentialId));
        return {
          agentPrincipalId: row.agentPrincipalId,
          masterFn: row.masterFn,
          companyFn: row.companyFn,
          issuer: 'erp-system-local-agent-issuer',
          audience: 'erp-system-agent-actions',
          subject: row.principalKey,
        };
      });
    },
  };
}

export function bearerAgentToken(req: express.Request): string | undefined {
  const value = req.header('authorization');
  if (!value?.startsWith('Bearer ')) return undefined;
  const token = value.slice('Bearer '.length).trim();
  return token || undefined;
}
