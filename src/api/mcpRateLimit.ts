import { createHash } from 'node:crypto';

export interface McpRateLimitPolicy {
  maxRequests: number;
  windowMs: number;
  maxEntries?: number;
}

export const DEFAULT_MCP_RATE_LIMIT: Required<McpRateLimitPolicy> = {
  maxRequests: 60,
  windowMs: 60_000,
  maxEntries: 10_000,
};

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
  lastSeenAt: number;
}

export interface McpRateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && value! > 0 ? value! : fallback;
}

function normalizePolicy(policy: McpRateLimitPolicy | undefined): Required<McpRateLimitPolicy> {
  return {
    maxRequests: positiveInteger(policy?.maxRequests, DEFAULT_MCP_RATE_LIMIT.maxRequests),
    windowMs: positiveInteger(policy?.windowMs, DEFAULT_MCP_RATE_LIMIT.windowMs),
    maxEntries: positiveInteger(policy?.maxEntries, DEFAULT_MCP_RATE_LIMIT.maxEntries),
  };
}

/**
 * A bounded process-local guard for the MCP HTTP boundary. Production with
 * multiple API instances must enforce the same policy at a shared gateway or
 * distributed store; this class deliberately does not pretend local memory is
 * a cluster-wide counter.
 */
export class McpRateLimiter {
  private readonly policy: Required<McpRateLimitPolicy>;
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(policy?: McpRateLimitPolicy) {
    this.policy = normalizePolicy(policy);
  }

  check(rawKey: string, now = new Date()): McpRateLimitDecision {
    const nowMs = now.getTime();
    const key = createHash('sha256').update(rawKey).digest('hex');
    this.prune(nowMs, key);
    let entry = this.entries.get(key);
    if (!entry || nowMs - entry.windowStartedAt >= this.policy.windowMs) {
      entry = { count: 0, windowStartedAt: nowMs, lastSeenAt: nowMs };
      this.entries.set(key, entry);
    }
    entry.lastSeenAt = nowMs;
    const resetAtMs = entry.windowStartedAt + this.policy.windowMs;
    if (entry.count >= this.policy.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
      return {
        allowed: false,
        limit: this.policy.maxRequests,
        remaining: 0,
        resetAt: new Date(resetAtMs),
        retryAfterSeconds,
      };
    }
    entry.count += 1;
    return {
      allowed: true,
      limit: this.policy.maxRequests,
      remaining: Math.max(0, this.policy.maxRequests - entry.count),
      resetAt: new Date(resetAtMs),
      retryAfterSeconds: 0,
    };
  }

  private prune(nowMs: number, preserveKey: string): void {
    for (const [key, entry] of this.entries) {
      if (nowMs - entry.windowStartedAt >= this.policy.windowMs) {
        this.entries.delete(key);
      }
    }
    while (this.entries.size >= this.policy.maxEntries && !this.entries.has(preserveKey)) {
      const oldest = [...this.entries.entries()]
        .sort(([, left], [, right]) => left.lastSeenAt - right.lastSeenAt)[0];
      if (!oldest) return;
      this.entries.delete(oldest[0]);
    }
  }
}
