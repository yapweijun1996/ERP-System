import { Router } from 'express';
import type { DB } from '../../data/db';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  approveAllowanceCalculationWithin,
  calculateAllowance,
  closeCashAdvanceWithin,
  configureAllowancePolicyVersion,
  ExpenseSettlementError,
  issueCashAdvance,
  listAllowanceAndAdvanceQueueWithin,
} from '../../modules/expenses/allowancesAdvances';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';

function positiveId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function handle(res: import('express').Response, error: unknown): void {
  if (error instanceof ExpenseSettlementError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  throw error;
}

export function createAllowancesAdvancesRouter(db: DB): Router {
  const router = Router();

  router.post('/allowance-policies/versions', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.expensesAllowanceManage)) {
      apiError(res, 403, 'permission_denied', 'Allowance policy management permission is required.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await configureAllowancePolicyVersion(db, scope, session.userId, req.body ?? {});
      await withTenantTransaction(db, scope, (tx) => appendAudit(tx, {
        ...scope,
        actorUserId: session.userId,
        requestId: context(res).requestId,
        entity: 'expense_allowance_policy_version',
        entityId: data.policy.id,
        action: data.replayed ? 'configure_replay' : 'configure',
        after: {
          policyKey: data.policy.policyKey,
          versionNo: data.policy.versionNo,
          allowanceType: data.policy.allowanceType,
        },
      }));
      res.status(data.replayed ? 200 : 201).json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/allowances/calculations', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.employeeClaimsWrite)) {
      apiError(res, 403, 'permission_denied', 'Employee claim permission is required.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await calculateAllowance(db, scope, session.userId, req.body ?? {});
      await withTenantTransaction(db, scope, (tx) => appendAudit(tx, {
        ...scope,
        actorUserId: session.userId,
        requestId: context(res).requestId,
        entity: 'expense_allowance_calculation',
        entityId: data.calculation.id,
        action: data.replayed ? 'calculate_replay' : 'calculate',
        after: {
          allowanceType: data.calculation.allowanceType,
          units: data.calculation.units,
          amount: data.calculation.amount,
          receiptRequired: data.calculation.receiptRequired,
        },
      }));
      res.status(data.replayed ? 200 : 201).json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/allowances/calculations/:id/actions/approve', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.expensesAllowanceManage)) {
      apiError(res, 403, 'permission_denied', 'Allowance approval permission is required.');
      return;
    }
    const calculationId = positiveId(req.params.id);
    if (!calculationId) {
      apiError(res, 400, 'allowance_calculation_id_invalid', 'A valid allowance calculation is required.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const calculation = await approveAllowanceCalculationWithin(
          tx,
          scope,
          session.userId,
          calculationId,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'expense_allowance_calculation',
          entityId: calculation.id,
          action: 'approve',
          after: { status: calculation.status, amount: calculation.amount },
        });
        return calculation;
      });
      res.json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/cash-advances', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.expensesAdvanceManage)) {
      apiError(res, 403, 'permission_denied', 'Cash-advance management permission is required.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await issueCashAdvance(db, scope, session.userId, req.body ?? {});
      await withTenantTransaction(db, scope, (tx) => appendAudit(tx, {
        ...scope,
        actorUserId: session.userId,
        requestId: context(res).requestId,
        entity: 'cash_advance',
        entityId: data.advance.id,
        action: data.replayed ? 'issue_replay' : 'issue',
        after: {
          advanceNo: data.advance.advanceNo,
          employeeId: data.advance.employeeId,
          issuedAmount: data.advance.issuedAmount,
          currency: data.advance.currency,
        },
      }));
      res.status(data.replayed ? 200 : 201).json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/cash-advances/:id/actions/close', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.expensesAdvanceManage)) {
      apiError(res, 403, 'permission_denied', 'Cash-advance management permission is required.');
      return;
    }
    const advanceId = positiveId(req.params.id);
    if (!advanceId) {
      apiError(res, 400, 'cash_advance_id_invalid', 'A valid cash advance is required.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const result = await closeCashAdvanceWithin(
          tx,
          scope,
          session.userId,
          advanceId,
          req.body ?? {},
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'cash_advance',
          entityId: advanceId,
          action: 'close',
          after: result.reconciliation,
        });
        return result;
      });
      res.json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  router.get('/queue', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const canManageAllowance = await hasPermission(
      db,
      session,
      PERMISSIONS.expensesAllowanceManage,
    );
    const canManageAdvance = await hasPermission(
      db,
      session,
      PERMISSIONS.expensesAdvanceManage,
    );
    if (!canManageAllowance
      && !canManageAdvance
      && !await hasPermission(db, session, PERMISSIONS.employeeSelfRead)) {
      apiError(res, 403, 'permission_denied', 'Expense settlement read permission is required.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        listAllowanceAndAdvanceQueueWithin(
          tx,
          scope,
          canManageAllowance || canManageAdvance ? undefined : session.userId,
        ));
      res.json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  return router;
}
