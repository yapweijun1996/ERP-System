import { describe, expect, it } from 'vitest';
import {
  MCP_ENDPOINT_PATH,
  MCP_PROTOCOL_VERSION,
  createLocalMcpAuthorizationFixture,
  newLocalMcpFixtureToken,
} from './mcpAuthorization';

const resourceUri = 'https://erp.example.test/api/mcp/v1';
const issuer = 'https://issuer.example.test';

function fixtureIdentity(scopes: readonly ('erp.receipts.read' | 'erp.receipts.prepare' | 'erp.receipts.execute')[]) {
  return {
    agentPrincipalId: 41,
    masterFn: 'M1',
    companyFn: 'C-SG',
    issuer,
    audience: resourceUri,
    subject: 'mcp-receipt-agent',
    scopes,
  } as const;
}

describe('MCP authorization topology fixture', () => {
  it('pins the versioned resource, protocol era and least-privilege scope map', () => {
    expect(MCP_ENDPOINT_PATH).toBe('/api/mcp/v1');
    expect(MCP_PROTOCOL_VERSION).toBe('2025-11-25');

    const fixture = createLocalMcpAuthorizationFixture({ issuer, resourceUri });
    const token = newLocalMcpFixtureToken();
    fixture.issue(token, {
      identity: fixtureIdentity(['erp.receipts.read', 'erp.receipts.prepare']),
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });

    return expect(fixture.adapter.authenticate({
      bearerToken: token,
      method: 'POST',
      path: MCP_ENDPOINT_PATH,
      requestId: 'mcp-s1-valid',
      resourceUri,
      requiredScopes: ['erp.receipts.read'],
    })).resolves.toMatchObject({
      agentPrincipalId: 41,
      masterFn: 'M1',
      companyFn: 'C-SG',
      subject: 'mcp-receipt-agent',
      scopes: ['erp.receipts.read', 'erp.receipts.prepare'],
    });
  });

  it('fails closed for wrong resource, missing scope, expiry and revocation', async () => {
    const fixture = createLocalMcpAuthorizationFixture({ issuer, resourceUri });
    const token = newLocalMcpFixtureToken();
    fixture.issue(token, {
      identity: fixtureIdentity(['erp.receipts.read']),
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    const base = {
      bearerToken: token,
      method: 'POST',
      path: MCP_ENDPOINT_PATH,
      requestId: 'mcp-s1-negative',
      resourceUri,
      requiredScopes: ['erp.receipts.read'] as const,
    };

    await expect(fixture.adapter.authenticate({
      ...base,
      resourceUri: 'https://other.example.test/api/mcp/v1',
    })).resolves.toBeNull();
    await expect(fixture.adapter.authenticate({
      ...base,
      requiredScopes: ['erp.receipts.execute'],
    })).resolves.toBeNull();

    const expiredToken = newLocalMcpFixtureToken();
    const expiredIdentity = fixtureIdentity(['erp.receipts.read']);
    fixture.issue(expiredToken, {
      identity: expiredIdentity,
      expiresAt: Math.floor(Date.now() / 1000) + 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await expect(fixture.adapter.authenticate({
      ...base,
      bearerToken: expiredToken,
    })).resolves.toBeNull();

    fixture.revoke(token);
    await expect(fixture.adapter.authenticate(base)).resolves.toBeNull();
  });
});
