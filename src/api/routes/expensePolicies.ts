import { Router } from 'express';
import type { DB } from '../../data/db';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import {
  configureExpensePolicyVersion,
  ExpensePolicyError,
  snapshotSubmittedExpenseLine,
  verifyActualBankCharge,
} from '../../modules/expenses/policy';
import {
  configureExpenseControlPolicyVersion,
  ExpenseControlError,
} from '../../modules/expenses/controls';
import { DocumentQuarantineError } from '../../modules/documents/processing';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';
import { withTenantTransaction } from '../../data/tenantTransaction';

function body(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function handle(res: import('express').Response, error: unknown): void {
  if (error instanceof ExpenseControlError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  if (error instanceof ExpensePolicyError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  if (error instanceof DocumentQuarantineError) {
    apiError(res, 423, error.code, error.message, {
      action: error.action,
      scanStatus: error.scanStatus,
    });
    return;
  }
  throw error;
}

export function createExpensePoliciesRouter(db: DB): Router {
  const router = Router();

  router.post('/controls/versions', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.expensesPolicyManage)) {
      apiError(res, 403, 'permission_denied', 'Expense-policy permission is required.');
      return;
    }
    const input = body(req.body);
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await configureExpenseControlPolicyVersion(
        db,
        scope,
        session.userId,
        input as unknown as Parameters<typeof configureExpenseControlPolicyVersion>[3],
      );
      await withTenantTransaction(db, scope, (tx) => appendAudit(tx, {
        ...scope,
        actorUserId: session.userId,
        requestId: context(res).requestId,
        entity: 'expense_control_policy_version',
        entityId: data.version.id,
        action: data.replayed ? 'confirm_replay' : 'confirm',
        after: {
          versionNo: data.version.versionNo,
          budgetAction: data.version.budgetAction,
          duplicateHighRiskScore: data.version.duplicateHighRiskScore,
        },
      }));
      res.status(data.replayed ? 200 : 201).json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/versions', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.expensesPolicyManage)) {
      apiError(res, 403, 'permission_denied', 'Expense-policy permission is required.');
      return;
    }
    const input = body(req.body);
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await configureExpensePolicyVersion(
        db,
        scope,
        session.userId,
        input as unknown as Parameters<typeof configureExpensePolicyVersion>[3],
      );
      await withTenantTransaction(db, scope, (tx) => appendAudit(tx, {
        ...scope,
        actorUserId: session.userId,
        requestId: context(res).requestId,
        entity: 'expense_policy_version',
        entityId: data.version.id,
        action: data.replayed ? 'confirm_replay' : 'confirm',
        after: {
          categoryId: data.category.id,
          policyId: data.policy.id,
          versionNo: data.version.versionNo,
        },
      }));
      res.status(data.replayed ? 200 : 201).json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/snapshots', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.employeeSelfRead)) {
      apiError(res, 403, 'permission_denied', 'Employee self-service permission is required.');
      return;
    }
    const input = body(req.body);
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await snapshotSubmittedExpenseLine(
        db,
        scope,
        session.userId,
        input as unknown as Parameters<typeof snapshotSubmittedExpenseLine>[3],
      );
      await withTenantTransaction(db, scope, (tx) => appendAudit(tx, {
        ...scope,
        actorUserId: session.userId,
        requestId: context(res).requestId,
        entity: 'expense_line_policy_snapshot',
        entityId: data.snapshot.id,
        action: data.replayed ? 'submit_replay' : 'submit',
        after: {
          policyVersionId: data.snapshot.policyVersionId,
          originalCurrency: data.snapshot.originalCurrency,
          functionalCurrency: data.snapshot.functionalCurrency,
          baseGross: data.snapshot.baseGross,
        },
      }));
      res.status(data.replayed ? 200 : 201).json({ data, meta: { actorDerived: true } });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/snapshots/:id/actual-bank-charge', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const snapshotId = Number(req.params.id);
    if (!Number.isSafeInteger(snapshotId) || snapshotId <= 0) {
      apiError(res, 400, 'invalid_id', 'Snapshot id must be a positive integer.');
      return;
    }
    const canFinance = await hasPermission(
      db,
      session,
      PERMISSIONS.expensesFinanceVerify,
    );
    if (!canFinance) {
      apiError(res, 403, 'permission_denied', 'Finance verification permission is required.');
      return;
    }
    const input = body(req.body);
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await verifyActualBankCharge(
        db,
        scope,
        { userId: session.userId, canFinance },
        {
          snapshotId,
          actualBaseGross: input.actualBaseGross as string | number,
          evidenceVersionId: Number(input.evidenceVersionId),
          reason: String(input.reason ?? ''),
        },
      );
      await withTenantTransaction(db, scope, (tx) => appendAudit(tx, {
        ...scope,
        actorUserId: session.userId,
        requestId: context(res).requestId,
        entity: 'expense_bank_charge_override',
        entityId: data.override.id,
        action: data.replayed ? 'verify_replay' : 'verify',
        after: {
          snapshotId,
          actualBaseGross: data.override.actualBaseGross,
          evidenceVersionId: data.override.evidenceVersionId,
        },
      }));
      res.status(data.replayed ? 200 : 201).json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  return router;
}
