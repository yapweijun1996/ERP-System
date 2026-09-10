import { describe, expect, it } from 'vitest';
import { McpRateLimiter } from './mcpRateLimit';

describe('MCP rate limiter', () => {
  it('allows the configured window and returns standard budget facts', () => {
    const limiter = new McpRateLimiter({ maxRequests: 2, windowMs: 1_000 });
    const now = new Date('2026-09-09T12:00:00.000Z');
    expect(limiter.check('opaque-token', now)).toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 1,
      retryAfterSeconds: 0,
    });
    expect(limiter.check('opaque-token', new Date(now.getTime() + 100))).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.check('opaque-token', new Date(now.getTime() + 200))).toMatchObject({
      allowed: false,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 1,
    });
  });

  it('resets after the window and isolates different keys', () => {
    const limiter = new McpRateLimiter({ maxRequests: 1, windowMs: 1_000 });
    const now = new Date('2026-09-09T12:00:00.000Z');
    expect(limiter.check('token-a', now).allowed).toBe(true);
    expect(limiter.check('token-b', new Date(now.getTime() + 100)).allowed).toBe(true);
    expect(limiter.check('token-a', new Date(now.getTime() + 1_000)).allowed).toBe(true);
  });

  it('bounds retained key state', () => {
    const limiter = new McpRateLimiter({ maxRequests: 1, windowMs: 60_000, maxEntries: 2 });
    const now = new Date('2026-09-09T12:00:00.000Z');
    expect(limiter.check('token-a', now).allowed).toBe(true);
    expect(limiter.check('token-b', new Date(now.getTime() + 1)).allowed).toBe(true);
    expect(limiter.check('token-c', new Date(now.getTime() + 2)).allowed).toBe(true);
    expect(limiter.check('token-c', new Date(now.getTime() + 3)).allowed).toBe(false);
  });
});
