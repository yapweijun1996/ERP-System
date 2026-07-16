// Minimal session store (TASK-024). In-memory Map, not Redis/DB-backed — a real
// "minimal real auth" scaffold, not a production session layer: restarting the API
// process logs everyone out, and sessions don't survive a multi-instance deployment.
// Good enough to stop trusting client-supplied masterFn/companyFn; a durable,
// horizontally-scalable session store is future work once there's more than one
// api instance.
import { randomBytes } from 'node:crypto';

export interface SessionData {
  userId: number;
  masterFn: string;
  email: string;
  fullName: string | null;
}

const sessions = new Map<string, SessionData>();

export function createSession(data: SessionData): string {
  const sessionId = randomBytes(24).toString('hex');
  sessions.set(sessionId, data);
  return sessionId;
}

export function getSession(sessionId: string | undefined): SessionData | null {
  if (!sessionId) return null;
  return sessions.get(sessionId) ?? null;
}

export function destroySession(sessionId: string | undefined): void {
  if (sessionId) sessions.delete(sessionId);
}

/** Parse a raw `Cookie` request header without the cookie-parser dependency. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}
