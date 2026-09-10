import { Router } from 'express';
import type { DB } from '../../data/db';
import {
  KnowledgeRetrievalError,
  resolveGovernedSopCitationWithin,
  searchGovernedSopWithin,
} from '../../modules/agent/knowledgeRetrieval';
import { apiError, requireSession } from '../http';

function positiveInteger(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : NaN;
}

function requestedFields(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  return String(value).split(',').map((field) => field.trim()).filter(Boolean);
}

function handleError(res: import('express').Response, error: unknown): void {
  if (error instanceof KnowledgeRetrievalError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  throw error;
}

/** Tenant-facing, read-only SOP retrieval. The module owns the live permission
 * check and all tenant/record/field filtering; this router only parses query
 * input and supplies the authenticated SessionData. */
export function createKnowledgeRouter(db: DB): Router {
  const router = Router();

  router.get('/sop/:id', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const knowledgeId = positiveInteger(req.params.id);
    if (knowledgeId == null || Number.isNaN(knowledgeId)) {
      apiError(res, 400, 'agent_knowledge_input_invalid', 'Knowledge document id is invalid.');
      return;
    }
    const effectiveOn = typeof req.query.effectiveOn === 'string'
      ? req.query.effectiveOn : undefined;
    const sourceSha256 = typeof req.query.sourceSha256 === 'string'
      ? req.query.sourceSha256 : undefined;
    try {
      const data = await resolveGovernedSopCitationWithin(db, session, {
        knowledgeId,
        effectiveOn,
        sourceSha256,
      });
      res.json({
        data,
        meta: {
          sourceResolution: 'governed_knowledge_citation',
          asOf: data.citation.asOf,
          evidence: data.evidence,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/sop', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const limit = positiveInteger(req.query.limit);
    const afterId = positiveInteger(req.query.afterId);
    if (Number.isNaN(limit) || Number.isNaN(afterId)) {
      apiError(res, 400, 'agent_knowledge_input_invalid', 'SOP pagination values are invalid.');
      return;
    }
    try {
      const result = await searchGovernedSopWithin(db, session, {
        corpusKey: typeof req.query.corpusKey === 'string' ? req.query.corpusKey : undefined,
        query: typeof req.query.query === 'string' ? req.query.query : undefined,
        effectiveOn: typeof req.query.effectiveOn === 'string' ? req.query.effectiveOn : undefined,
        limit,
        afterId,
        fields: requestedFields(req.query.fields),
      });
      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
}
