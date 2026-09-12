import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import type { Scope } from '../data/repo';
import { agentPrincipal, appUser } from '../data/schema';
import { appendAudit } from '../api/audit';
import type { createAgentExecutionIntentCommands } from '../modules/agent/agentExecutionIntentCommands';
import type { CompanyReceiptReadVisibility } from '../modules/expenses/companyReceipt';

type Commands = ReturnType<typeof createAgentExecutionIntentCommands>;
const denied = () => Object.assign(new Error('This Demo assistant intent belongs to a different user or Company.'), { code: 'assistant_identity_mismatch' });

/** Local Demo bootstrap only: no login, credentials, role grants or external access. */
async function principalWithin(db: DB, scope: Scope, actorUserId: number) {
  const principalKey = `demo-receipt-assistant-${actorUserId}`;
  const [existing] = await db.select().from(agentPrincipal).where(and(
    eq(agentPrincipal.masterFn, scope.masterFn), eq(agentPrincipal.companyFn, scope.companyFn),
    eq(agentPrincipal.principalKey, principalKey),
  )).limit(1);
  if (existing) {
    if (existing.ownerUserId !== actorUserId || existing.status !== 'active' || existing.revokedAt) throw denied();
    return existing.id;
  }
  const [actor] = await db.select().from(appUser).where(and(
    eq(appUser.masterFn, scope.masterFn), eq(appUser.userId, actorUserId),
    eq(appUser.identityKind, 'human'), eq(appUser.isActive, true),
    eq(appUser.loginEnabled, true), eq(appUser.accountState, 'active'),
  )).limit(1);
  if (!actor) throw denied();
  const [bridge] = await db.insert(appUser).values({
    masterFn: scope.masterFn, username: `__demo_receipts_${crypto.randomUUID().replaceAll('-', '')}`,
    fullName: 'Demo Receipt Assistant', passwordHash: '!disabled-demo-agent!',
    identityKind: 'agent', loginEnabled: false, language: 'en', isActive: true, accountState: 'active',
  }).returning();
  const [principal] = await db.insert(agentPrincipal).values({
    ...scope, principalKey, displayName: 'Demo Receipt Assistant', kind: 'delegated_agent',
    actorUserId: bridge.userId, ownerUserId: actorUserId, status: 'active',
  }).returning();
  await appendAudit(db, { ...scope, actorUserId,
    requestId: crypto.randomUUID(), entity: 'agent_principal', entityId: principal.id,
    action: 'demo_initialized', after: { syntheticDemo: true, loginEnabled: false, credentialsCreated: false },
  });
  return principal.id;
}

export function createDemoReceiptAssistantCommands(commands: Commands) {
  async function owned(db: DB, scope: Scope, actorUserId: number, intentId: number) {
    const intent = await commands.readAgentExecutionIntentWithin(db, scope, intentId);
    if (intent.actorUserId !== actorUserId) throw denied();
    return intent;
  }
  return {
    async prepare(db: DB, scope: Scope, actorUserId: number, visibility: CompanyReceiptReadVisibility,
      input: { packKey: string; intentKey: string; search: string; dateFrom: string; dateTo: string; locale: string }) {
      const agentPrincipalId = await principalWithin(db, scope, actorUserId);
      return commands.prepareAgentExecutionIntentWithin(db, scope, {
        ...input, agentPrincipalId, actorUserId, visibility, requestId: crypto.randomUUID(),
      });
    },
    async decide(db: DB, scope: Scope, actorUserId: number, decision: string,
      input: { intentId: number; expectedVersion: number; reason: string }) {
      await owned(db, scope, actorUserId, input.intentId);
      const method = decision === 'approve' ? commands.approveAgentExecutionIntentWithin
        : decision === 'cancel' ? commands.cancelAgentExecutionIntentWithin
        : decision === 'reject' ? commands.rejectAgentExecutionIntentWithin : null;
      if (!method) throw new Error('Receipt assistant decision is invalid.');
      return method(db, scope, { ...input, decisionByUserId: actorUserId, requestId: crypto.randomUUID() });
    },
    async execute(db: DB, scope: Scope, actorUserId: number, visibility: CompanyReceiptReadVisibility,
      input: { executionIntentId: number; executionIntentKey: string; packKey: string; search: string;
        dateFrom: string; dateTo: string; locale: string; selectionDigest: string; payloadDigest: string }) {
      const intent = await owned(db, scope, actorUserId, input.executionIntentId);
      const result = await commands.executeAgentReceiptPackWithin(db, scope, {
        ...input, intentId: input.executionIntentId, intentKey: input.executionIntentKey,
        agentPrincipalId: intent.agentPrincipalId, actorUserId, visibility, requestId: crypto.randomUUID(),
      });
      await appendAudit(db, { ...scope, actorUserId, agentPrincipalId: intent.agentPrincipalId,
        delegatorUserId: actorUserId, requestId: crypto.randomUUID(), entity: 'agent_execution_intent',
        entityId: intent.id, action: result.replayed ? 'replayed' : 'executed',
        after: { packId: result.pack.id, sourceSha256: result.pack.sourceSha256 },
      });
      return result;
    },
  };
}
