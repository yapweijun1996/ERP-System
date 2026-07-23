import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { company } from '../../data/schema';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import {
  approveBudgetWithin,
  BudgetError,
  createBudgetVersionWithin,
  importBudgetLinesWithin,
  listBudgetLinesWithin,
  listBudgetVersionsWithin,
  type BudgetImportRow,
} from '../../modules/finance/budget';
import {
  buildProfitLossReport,
  getProfitLossOptions,
  ProfitLossError,
  type ProfitLossComparison,
} from '../../modules/finance/profitLoss';
import {
  createProfitLossExportJobWithin,
  ReportJobError,
  type ProfitLossExportFilters,
} from '../../modules/reporting/reportJobs';
import { appendAudit } from '../audit';
import { ActionDispatchError, dispatchAction } from '../actionDispatcher';
import { apiError, context, requireSession } from '../http';

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function reportFilters(query: Record<string, unknown>): {
  periodId?: number;
  companyFns?: string[];
  presentationCurrency?: string;
  comparison?: ProfitLossComparison;
} {
  const periodId = query.periodId == null || query.periodId === ''
    ? undefined
    : positiveId(query.periodId);
  if (query.periodId != null && query.periodId !== '' && periodId == null) {
    throw new ProfitLossError('invalid_report_query', 'periodId must be a positive integer.');
  }
  const rawCompanies = Array.isArray(query.companyFns)
    ? query.companyFns
    : String(query.companyFns ?? '').split(',');
  const companyFns = rawCompanies.map(String).map((value) => value.trim()).filter(Boolean);
  return {
    ...(periodId ? { periodId } : {}),
    ...(companyFns.length ? { companyFns } : {}),
    ...(query.presentationCurrency
      ? { presentationCurrency: String(query.presentationCurrency) }
      : {}),
    ...(query.comparison
      ? { comparison: String(query.comparison) as ProfitLossComparison }
      : {}),
  };
}

function sendKnownError(res: Parameters<typeof apiError>[0], error: unknown): boolean {
  if (error instanceof ProfitLossError) {
    const status = error.code === 'company_access_denied' ? 403
      : error.code === 'period_not_found' ? 404
        : error.code === 'missing_consolidation_rate'
          || error.code === 'incompatible_fiscal_calendar' ? 422 : 400;
    apiError(res, status, error.code, error.message);
    return true;
  }
  if (error instanceof BudgetError) {
    const status = error.code === 'budget_not_found' ? 404
      : error.code === 'budget_immutable' ? 409 : 422;
    apiError(res, status, error.code, error.message, error.fieldErrors);
    return true;
  }
  if (error instanceof ReportJobError) {
    apiError(res, 422, error.code, error.message);
    return true;
  }
  if (error instanceof ActionDispatchError) {
    apiError(res, error.status, error.code, error.message);
    return true;
  }
  return false;
}

export function createFinanceReportsRouter(db: DB): Router {
  const router = Router();

  router.get('/reports/profit-loss/options', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.financeRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read financial reports.');
      return;
    }
    try {
      const data = await getProfitLossOptions(db, {
        masterFn: session.masterFn,
        activeCompanyFn: session.activeCompanyFn,
        actorUserId: session.userId,
      });
      res.json({
        data: {
          ...data,
          capabilities: {
            manageBudget: await hasPermission(db, session, PERMISSIONS.financeBudgetManage),
            approveBudget: await hasPermission(db, session, PERMISSIONS.financeBudgetApprove),
            exportReport: await hasPermission(db, session, PERMISSIONS.financeReportExport),
          },
        },
        meta: {},
      });
    } catch (error) {
      if (!sendKnownError(res, error)) throw error;
    }
  });

  router.get('/reports/profit-loss', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.financeRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read financial reports.');
      return;
    }
    try {
      const report = await buildProfitLossReport(db, {
        masterFn: session.masterFn,
        activeCompanyFn: session.activeCompanyFn,
        actorUserId: session.userId,
        ...reportFilters(req.query as Record<string, unknown>),
      });
      res.json(report);
    } catch (error) {
      if (!sendKnownError(res, error)) throw error;
    }
  });

  router.get('/budgets', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.financeRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read budgets.');
      return;
    }
    const fiscalYear = req.query.fiscalYear == null
      ? undefined : Number(req.query.fiscalYear);
    if (fiscalYear != null && (!Number.isSafeInteger(fiscalYear) || fiscalYear < 2000)) {
      apiError(res, 400, 'invalid_fiscal_year', 'fiscalYear is invalid.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    res.json({
      data: await withTenantTransaction(
        db,
        scope,
        (tx) => listBudgetVersionsWithin(tx, scope, fiscalYear),
      ),
      meta: {},
    });
  });

  router.get('/budgets/:id/lines', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.financeRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read budgets.');
      return;
    }
    const id = positiveId(req.params.id);
    if (!id) {
      apiError(res, 400, 'invalid_id', 'Budget id must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      res.json({
        data: await withTenantTransaction(
          db,
          scope,
          (tx) => listBudgetLinesWithin(tx, scope, id),
        ),
        meta: {},
      });
    } catch (error) {
      if (!sendKnownError(res, error)) throw error;
    }
  });

  router.post('/budgets', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.financeBudgetManage)) {
      apiError(res, 403, 'permission_denied', 'You cannot create budgets.');
      return;
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown> : {};
    if ('masterFn' in body || 'companyFn' in body) {
      apiError(res, 400, 'tenant_override_rejected', 'Tenant scope comes from the session.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const created = await withTenantTransaction(db, scope, async (tx) => {
        const budget = await createBudgetVersionWithin(tx, scope, {
          fiscalYear: body.fiscalYear,
          name: body.name,
          currency: body.currency,
        });
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'finance/budgets',
          entityId: budget.id,
          action: 'create',
          after: budget,
        });
        return budget;
      });
      res.status(201).json({ data: created, meta: {} });
    } catch (error) {
      if (!sendKnownError(res, error)) throw error;
    }
  });

  router.post('/budgets/:id/actions/:action', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const id = positiveId(req.params.id);
    if (!id) {
      apiError(res, 400, 'invalid_id', 'Budget id must be a positive integer.');
      return;
    }
    if (!['import', 'approve'].includes(req.params.action)) {
      apiError(res, 404, 'action_not_found', 'Unknown budget action.');
      return;
    }
    const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown> : {};
    try {
      const result = await dispatchAction({
        db,
        session,
        resource: 'finance/budgets',
        resourceId: id,
        action: req.params.action,
        payload,
        idempotencyKey: req.header('idempotency-key'),
        requestId: context(res).requestId,
      }, {
        permission: req.params.action === 'approve'
          ? PERMISSIONS.financeBudgetApprove : PERMISSIONS.financeBudgetManage,
        idempotency: 'required',
        audit: 'required',
        execute: (tx, scope, input) => req.params.action === 'approve'
          ? approveBudgetWithin(tx, scope, id, input.actorUserId)
          : importBudgetLinesWithin(
            tx,
            scope,
            id,
            Array.isArray(payload.rows) ? payload.rows as BudgetImportRow[] : [],
          ),
      });
      if (result.replayed) res.setHeader('Idempotency-Replayed', 'true');
      res.status(result.status).json(result.body);
    } catch (error) {
      if (!sendKnownError(res, error)) throw error;
    }
  });

  router.post('/reports/profit-loss/actions/export', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown> : {};
    const filters = payload.filters && typeof payload.filters === 'object'
      ? reportFilters(payload.filters as Record<string, unknown>) : {};
    const [activeCompany] = await db.select({ currency: company.currency })
      .from(company)
      .where(and(
        eq(company.masterFn, session.masterFn),
        eq(company.companyFn, session.activeCompanyFn),
      ))
      .limit(1);
    if (!activeCompany) {
      apiError(res, 404, 'company_not_found', 'The active company is unavailable.');
      return;
    }
    const completeFilters: ProfitLossExportFilters = {
      companyFns: filters.companyFns ?? [session.activeCompanyFn],
      presentationCurrency: filters.presentationCurrency ?? activeCompany.currency,
      comparison: filters.comparison ?? 'budget',
      ...(filters.periodId ? { periodId: filters.periodId } : {}),
    };
    try {
      const result = await dispatchAction({
        db,
        session,
        resource: 'finance/reports/profit-loss/export',
        resourceId: 1,
        action: 'queue',
        payload,
        idempotencyKey: req.header('idempotency-key'),
        requestId: context(res).requestId,
      }, {
        permission: PERMISSIONS.financeReportExport,
        idempotency: 'required',
        audit: 'required',
        execute: (tx, scope, input) => createProfitLossExportJobWithin(tx, scope, {
          actorUserId: input.actorUserId,
          locale: payload.locale,
          format: payload.format,
          filters: completeFilters,
        }),
      });
      if (result.replayed) res.setHeader('Idempotency-Replayed', 'true');
      res.status(result.replayed ? result.status : 202).json(result.body);
    } catch (error) {
      if (!sendKnownError(res, error)) throw error;
    }
  });

  return router;
}
