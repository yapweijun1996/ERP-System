import { Router } from 'express';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { listPersonalActivityWithin } from '../../modules/account/activity';
import { apiError, requireSession } from '../http';

const ALLOWED_QUERY_KEYS = new Set(['cursor', 'limit']);

function decodeCursor(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('cursor must be an opaque string.');
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const match = decoded.match(/^activity:(\d+)$/);
    const id = match ? Number(match[1]) : Number.NaN;
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error();
    return id;
  } catch {
    throw new Error('cursor is invalid.');
  }
}

function encodeCursor(value: number | null): string | null {
  return value == null ? null : Buffer.from(`activity:${value}`).toString('base64url');
}

export function createAccountRouter(db: DB): Router {
  const router = Router();
  router.get('/activity', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const unsupported = Object.keys(req.query).find((key) => !ALLOWED_QUERY_KEYS.has(key));
    if (unsupported) {
      apiError(res, 400, 'invalid_query', `${unsupported} is an unsupported filter.`);
      return;
    }
    const limit = req.query.limit == null ? 50 : Number(req.query.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      apiError(res, 400, 'invalid_query', 'limit must be an integer from 1 to 100.');
      return;
    }
    let cursor: number | undefined;
    try {
      cursor = decodeCursor(req.query.cursor);
    } catch (error) {
      apiError(res, 400, 'invalid_query', (error as Error).message);
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const result = await withTenantTransaction(db, scope, (tx) =>
      listPersonalActivityWithin(tx, scope, session.userId, { limit, cursor }));
    res.json({ data: result.data, meta: { nextCursor: encodeCursor(result.nextCursor) } });
  });
  return router;
}
