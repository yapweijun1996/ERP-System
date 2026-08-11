import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { normalizeUsername, isValidUsername } from '../../auth/identifiers';
import { hashPassword } from '../../auth/password';
import {
  provisionEmployeeAccount,
  resetEmployeeTemporaryPassword,
  revealEmployeeTemporaryPassword,
} from '../../auth/employeeAccountLifecycle';
import {
  EmployeeAccountError,
  offboardEmployeeAccount,
  readEmployeeAccount,
} from '../../modules/hr/employeeAccount';
import {
  EmployeeCreateError,
  EmployeeUpdateError,
  InvalidEmployeeStateError,
  updateEmployeeWithin,
} from '../../modules/hr/employee';
import { ManagerRoleSyncError } from '../../modules/hr/managerRole';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import { appendAudit, listEntityAudit } from '../audit';
import { apiError, context, requireSession } from '../http';
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
} from '../idempotency';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { calendarOutboundConnection, employee } from '../../data/schema';
import {
  LeaveApplicationError,
  createLeaveDraftWithin,
  decideApprovedLeaveCancellationWithin,
  decideGovernedLeaveWithin,
  readGovernedLeaveWithin,
  voidLeaveApplicationWithin,
} from '../../modules/hr/leaveApplication';
import { listMyLeaveApprovalsWithin } from '../../modules/hr/leaveApproval';
import {
  LeaveBalanceError,
  projectEmployeeAnnualLeaveWithin,
} from '../../modules/hr/leaveBalance';
import { LeavePolicyError } from '../../modules/hr/leavePolicy';
import { ApprovalWorkflowError } from '../../modules/approval/workflow';
import {
  StaffOnboardingError,
  activateStaffOnboarding,
  createStaffOnboardingDraft,
  listStaffOnboardingDrafts,
  updateStaffOnboardingDraft,
  type StaffOnboardingDraftInput,
} from '../../modules/hr/staffOnboarding';
import {
  HolidayCalendarError,
  listCalendarHolidaysWithin,
} from '../../modules/hr/holidayCalendar';
import {
  LeaveApprovalWorkflowError,
  confirmLeaveApprovalWorkflowWithin,
  createLeaveApprovalWorkflowDraftWithin,
  listLeaveApprovalWorkflowsWithin,
  retireLeaveApprovalWorkflowWithin,
  type LeaveApprovalWorkflowInput,
} from '../../modules/hr/leaveApprovalWorkflow';
import {
  createCalendarHolidayDraftWithin,
  decideCalendarHolidayWithin,
  submitCalendarHolidayWithin,
  updateCalendarHolidayDraftWithin,
  type ManagedHolidayInput,
} from '../../modules/hr/holidayManagement';
import {
  cancelStaffAppointmentWithin,
  createStaffAppointmentWithin,
  StaffAppointmentError,
  updateStaffAppointmentWithin,
  type StaffAppointmentInput,
} from '../../modules/hr/appointment';
import {
  createCalendarOutboundConnectionWithin,
  enqueueStaffAppointmentCalendarSyncWithin,
} from '../../modules/hr/calendarSync';
import {
  listStaffCalendarWithin,
  StaffCalendarError,
  type StaffCalendarQuery,
} from '../../modules/hr/staffCalendar';

export interface HrRouterOptions {
  tokenEncryptionKey?: Buffer;
}

export function createHrRouter(db: DB, options: HrRouterOptions = {}): Router {
  const router = Router();

  function employeeIdParam(value: string): number | null {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function handleError(res: import('express').Response, error: unknown): void {
    if (error instanceof EmployeeCreateError || error instanceof EmployeeUpdateError) {
      apiError(res, error.status, error.code, error.message, error.fieldErrors);
      return;
    }
    if (error instanceof InvalidEmployeeStateError || error instanceof ManagerRoleSyncError) {
      apiError(res, 422, 'validation_failed', error.message);
      return;
    }
    if (error instanceof EmployeeAccountError) {
      apiError(res, error.status, error.code, error.message, error.fieldErrors);
      return;
    }
    if (error instanceof StaffOnboardingError) {
      apiError(res, error.status, error.code, error.message, error.fieldErrors);
      return;
    }
    if (error instanceof HolidayCalendarError) {
      apiError(res, error.status, error.code, error.message);
      return;
    }
    if (error instanceof StaffAppointmentError) {
      apiError(res, error.status, error.code, error.message, error.details);
      return;
    }
    if (error instanceof StaffCalendarError) {
      apiError(res, error.status, error.code, error.message);
      return;
    }
    if (error instanceof LeaveApprovalWorkflowError) {
      apiError(res, error.status, error.code, error.message, error.fieldErrors);
      return;
    }
    if (
      error instanceof LeaveApplicationError
      || error instanceof LeaveBalanceError
      || error instanceof LeavePolicyError
      || error instanceof ApprovalWorkflowError
    ) {
      const status = error instanceof LeaveApplicationError
        || error instanceof ApprovalWorkflowError
        ? error.status
        : 422;
      const details = error instanceof LeaveApplicationError
        || error instanceof LeaveBalanceError
        || error instanceof ApprovalWorkflowError
        ? error.details
        : undefined;
      apiError(res, status, error.code, error.message, details);
      return;
    }
    throw error;
  }

  async function requireHr(
    req: import('express').Request,
    res: import('express').Response,
    permission: string,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (!await hasPermission(db, session, permission)) {
      apiError(res, 403, 'permission_denied', 'You cannot manage employee accounts.');
      return null;
    }
    return session;
  }

  async function runIdempotent(
    req: import('express').Request,
    res: import('express').Response,
    session: NonNullable<Awaited<ReturnType<typeof requireSession>>>,
    operation: string,
    payload: unknown,
    execute: () => Promise<{ status: number; data: unknown }>,
  ) {
    const key = req.header('idempotency-key')?.trim() ?? '';
    if (!key || key.length > 128) {
      apiError(res, 400, 'idempotency_key_required', 'A valid Idempotency-Key is required.');
      return;
    }
    const begun = await beginIdempotentRequest(db, {
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
      actorUserId: session.userId,
    }, key, operation, payload);
    if (begun.kind === 'replay') {
      res.setHeader('Idempotency-Replayed', 'true');
      res.status(begun.status).json(begun.body);
      return;
    }
    if (begun.kind === 'conflict') {
      apiError(
        res,
        begun.reason === 'in_progress' ? 409 : 422,
        `idempotency_${begun.reason}`,
        begun.reason === 'in_progress'
          ? 'This request is already in progress.'
          : 'This Idempotency-Key was used for a different request.',
      );
      return;
    }
    const result = await execute();
    const body = { data: result.data, meta: {} };
    await completeIdempotentRequest(db, begun.recordId, result.status, body);
    res.status(result.status).json(body);
  }

  async function managementActor(
    tx: DB,
    scope: { masterFn: string; companyFn: string },
    userId: number,
  ) {
    const [linked] = await tx.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.userId, userId),
    )).limit(1);
    return { userId, employeeId: linked?.id ?? null, canManage: true };
  }

  router.patch('/employees/:employeeId', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const employeeId = employeeIdParam(req.params.employeeId);
    if (!employeeId) {
      apiError(res, 400, 'invalid_id', 'employeeId must be a positive integer.');
      return;
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      apiError(res, 400, 'invalid_request', 'A JSON object body is required.');
      return;
    }
    const forbidden = [
      'id', 'masterFn', 'companyFn', 'userId', 'isActive', 'createdAt', 'updatedAt',
    ].find((field) => field in body);
    if (forbidden) {
      apiError(res, 400, 'immutable_field', `${forbidden} cannot be changed from the employee profile.`);
      return;
    }
    const rawIfMatch = req.header('if-match')?.trim() ?? '';
    const expectedUpdatedAt = rawIfMatch
      .replace(/^W\//i, '')
      .replace(/^"|"$/g, '');
    if (!expectedUpdatedAt) {
      apiError(res, 428, 'if_match_required', 'If-Match is required when updating an employee profile.');
      return;
    }
    const rawManagerId = (body as Record<string, unknown>).managerId;
    const managerId = rawManagerId == null || rawManagerId === '' ? null : Number(rawManagerId);
    if (managerId != null && !Number.isSafeInteger(managerId)) {
      apiError(res, 422, 'validation_failed', 'managerId must be a valid employee id.');
      return;
    }
    const scope = {
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
    };
    const input = {
      employeeNo: typeof body.employeeNo === 'string' ? body.employeeNo : '',
      fullName: typeof body.fullName === 'string' ? body.fullName : '',
      email: typeof body.email === 'string' ? body.email : '',
      phone: body.phone == null ? null : typeof body.phone === 'string' ? body.phone : '',
      department: typeof body.department === 'string' ? body.department : '',
      jobTitle: typeof body.jobTitle === 'string' ? body.jobTitle : '',
      employmentType: typeof body.employmentType === 'string' ? body.employmentType : '',
      managerId,
      startDate: typeof body.startDate === 'string' ? body.startDate : '',
      annualLeaveDays: Number(body.annualLeaveDays),
      baseSalary: typeof body.baseSalary === 'number'
        ? String(body.baseSalary)
        : typeof body.baseSalary === 'string' ? body.baseSalary : '',
      expectedUpdatedAt,
      actorUserId: session.userId,
      requestId: context(res).requestId,
    };
    try {
      const updated = await withTenantTransaction(db, scope, async (tx) => {
        const result = await updateEmployeeWithin(tx, scope, employeeId, input);
        const auditRow = (row: typeof result.employee) => ({
          employeeNo: row.employeeNo,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          department: row.department,
          jobTitle: row.jobTitle,
          employmentType: row.employmentType,
          managerId: row.managerId,
          startDate: row.startDate,
          annualLeaveDays: row.annualLeaveDays,
          baseSalary: row.baseSalary,
          userId: row.userId,
          isActive: row.isActive,
        });
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'hr/employees',
          entityId: employeeId,
          action: 'update',
          before: auditRow(result.before),
          after: auditRow(result.employee),
        });
        return result.employee;
      });
      res.json({ data: updated, meta: { concurrency: 'updated_at' } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/employees/:employeeId/history', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const employeeId = employeeIdParam(req.params.employeeId);
    if (!employeeId) {
      apiError(res, 400, 'invalid_id', 'employeeId must be a positive integer.');
      return;
    }
    const limit = req.query.limit == null ? 50 : Number(req.query.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      apiError(res, 400, 'invalid_query', 'limit must be an integer between 1 and 100.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const visible = await withTenantTransaction(db, scope, (tx) => tx.select({ id: employee.id })
        .from(employee).where(and(
          eq(employee.id, employeeId),
          eq(employee.masterFn, scope.masterFn),
          eq(employee.companyFn, scope.companyFn),
        )).limit(1));
      if (!visible[0]) {
        apiError(res, 404, 'employee_not_found', 'Employee not found in the active company.');
        return;
      }
      const data = await withTenantTransaction(db, scope, (tx) => listEntityAudit(
        tx, scope, 'hr/employees', employeeId, limit,
      ));
      res.json({ data, meta: { entity: 'hr/employees', entityId: employeeId } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/calendar/holidays', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';
    const scope = {
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
    };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        listCalendarHolidaysWithin(tx, scope, { from, to }));
      res.json({
        data,
        meta: {
          source: 'calendar_holiday',
          tenantScoped: true,
          limit: 366,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/calendar/staff', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';
    const rawEmployeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : '';
    const employeeId = rawEmployeeId ? employeeIdParam(rawEmployeeId) : null;
    if (rawEmployeeId && !employeeId) {
      apiError(res, 400, 'invalid_id', 'employeeId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const response = await withTenantTransaction(db, scope, async (tx) => {
        const employees = await tx.select({ id: employee.id }).from(employee).where(and(
          eq(employee.masterFn, scope.masterFn),
          eq(employee.companyFn, scope.companyFn),
          eq(employee.isActive, true),
        ));
        const data = await listStaffCalendarWithin(tx, scope, employees.map(row => row.id), {
          from,
          to,
          employeeId,
          department: typeof req.query.department === 'string' ? req.query.department : null,
          status: typeof req.query.status === 'string'
            ? req.query.status as StaffCalendarQuery['status']
            : 'all',
        });
        return {
          data,
          canManage: await hasPermission(tx, session, PERMISSIONS.hrWrite),
        };
      });
      res.json({
        data: response.data,
        meta: {
          tenantScoped: true,
          canManage: response.canManage,
          privacy: 'hr_private',
          limit: 300,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/calendar/connections', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, tx => tx.select({
        id: calendarOutboundConnection.id,
        name: calendarOutboundConnection.name,
        provider: calendarOutboundConnection.provider,
        calendarRef: calendarOutboundConnection.calendarRef,
        isEnabled: calendarOutboundConnection.isEnabled,
        createdAt: calendarOutboundConnection.createdAt,
      }).from(calendarOutboundConnection).where(and(
        eq(calendarOutboundConnection.masterFn, scope.masterFn),
        eq(calendarOutboundConnection.companyFn, scope.companyFn),
      )).orderBy(calendarOutboundConnection.id));
      res.json({ data, meta: { tenantScoped: true, credentials: 'deployment-managed' } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/calendar/connections', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const provider = String(req.body?.provider ?? '').trim();
    if (!['generic', 'google', 'microsoft'].includes(provider)) {
      apiError(res, 400, 'invalid_provider', 'provider must be generic, google or microsoft.');
      return;
    }
    const payload = {
      name: String(req.body?.name ?? ''),
      provider: provider as 'generic' | 'google' | 'microsoft',
      calendarRef: String(req.body?.calendarRef ?? ''),
      isEnabled: req.body?.isEnabled !== false,
    };
    try {
      await runIdempotent(req, res, session, 'hr.calendar-connection.create', payload, async () => {
        const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
        const data = await withTenantTransaction(db, scope, async tx => {
          const connection = await createCalendarOutboundConnectionWithin(tx, scope, {
            ...payload,
            createdByUserId: session.userId,
          });
          await appendAudit(tx, {
            ...scope,
            actorUserId: session.userId,
            requestId: context(res).requestId,
            entity: 'hr/calendar-connections',
            entityId: connection.id,
            action: 'create',
            after: connection,
          });
          return connection;
        });
        return { status: 201, data };
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.patch('/calendar/connections/:connectionId', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const connectionId = employeeIdParam(req.params.connectionId);
    if (!connectionId) {
      apiError(res, 400, 'invalid_id', 'connectionId must be a positive integer.');
      return;
    }
    try {
      const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
      const data = await withTenantTransaction(db, scope, async tx => {
        const [before] = await tx.select().from(calendarOutboundConnection).where(and(
          eq(calendarOutboundConnection.id, connectionId),
          eq(calendarOutboundConnection.masterFn, scope.masterFn),
          eq(calendarOutboundConnection.companyFn, scope.companyFn),
        )).limit(1);
        if (!before) throw new Error('Calendar connection not found.');
        const [after] = await tx.update(calendarOutboundConnection).set({
          isEnabled: req.body?.isEnabled !== false,
          updatedAt: new Date(),
        }).where(and(
          eq(calendarOutboundConnection.id, connectionId),
          eq(calendarOutboundConnection.masterFn, scope.masterFn),
          eq(calendarOutboundConnection.companyFn, scope.companyFn),
        )).returning();
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'hr/calendar-connections',
          entityId: connectionId,
          action: 'update',
          before,
          after,
        });
        return after;
      });
      res.json({ data, meta: { tenantScoped: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  function staffAppointmentInput(body: Record<string, unknown>): StaffAppointmentInput {
    return {
      employeeId: Number(body.employeeId),
      appointmentType: typeof body.appointmentType === 'string' ? body.appointmentType : undefined,
      title: typeof body.title === 'string' ? body.title : '',
      description: body.description == null ? null : String(body.description),
      startAt: typeof body.startAt === 'string' ? body.startAt : '',
      endAt: typeof body.endAt === 'string' ? body.endAt : '',
      timeZone: body.timeZone == null ? null : String(body.timeZone),
      recurrenceRule: body.recurrenceRule == null ? null : String(body.recurrenceRule),
      reminderMinutesBefore: body.reminderMinutesBefore == null || body.reminderMinutesBefore === ''
        ? null : Number(body.reminderMinutesBefore),
      syncToExternal: body.syncToExternal === true,
      allDay: body.allDay === true,
      location: body.location == null ? null : String(body.location),
      status: typeof body.status === 'string' ? body.status : undefined,
    };
  }

  router.post('/calendar/appointments', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      apiError(res, 400, 'invalid_request', 'A JSON object body is required.');
      return;
    }
    const payload = staffAppointmentInput(body as Record<string, unknown>);
    try {
      await runIdempotent(req, res, session, 'hr.staff-appointment.create', payload, async () => {
        const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
        const data = await withTenantTransaction(db, scope, async (tx) => {
          const result = await createStaffAppointmentWithin(tx, scope, payload, session.userId);
          if (result.syncToExternal) {
            await enqueueStaffAppointmentCalendarSyncWithin(tx, scope, {
              appointmentId: result.id,
              eventType: 'created',
            });
          }
          await appendAudit(tx, {
            ...scope,
            actorUserId: session.userId,
            requestId: context(res).requestId,
            entity: 'hr/staff-appointments',
            entityId: result.id,
            action: 'create',
            after: result,
          });
          return result;
        });
        return { status: 201, data };
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.put('/calendar/appointments/:appointmentId', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const appointmentId = employeeIdParam(req.params.appointmentId);
    if (!appointmentId) {
      apiError(res, 400, 'invalid_id', 'appointmentId must be a positive integer.');
      return;
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      apiError(res, 400, 'invalid_request', 'A JSON object body is required.');
      return;
    }
    const expectedVersion = Number((body as Record<string, unknown>).expectedVersion);
    const payload = staffAppointmentInput(body as Record<string, unknown>);
    try {
      await runIdempotent(req, res, session, `hr.staff-appointment.update:${appointmentId}`, {
        expectedVersion, ...payload,
      }, async () => {
        const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
        const data = await withTenantTransaction(db, scope, async (tx) => {
          const result = await updateStaffAppointmentWithin(
            tx, scope, appointmentId, expectedVersion, payload, session.userId,
          );
          const syncEvent = result.after.syncToExternal
            ? result.before.syncToExternal ? 'changed' : 'created'
            : result.before.syncToExternal ? 'cancelled' : null;
          if (syncEvent) {
            await enqueueStaffAppointmentCalendarSyncWithin(tx, scope, {
              appointmentId,
              eventType: syncEvent,
            });
          }
          await appendAudit(tx, {
            ...scope,
            actorUserId: session.userId,
            requestId: context(res).requestId,
            entity: 'hr/staff-appointments',
            entityId: appointmentId,
            action: 'update',
            before: result.before,
            after: result.after,
          });
          return result.after;
        });
        return { status: 200, data };
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/calendar/appointments/:appointmentId/actions/cancel', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const appointmentId = employeeIdParam(req.params.appointmentId);
    if (!appointmentId) {
      apiError(res, 400, 'invalid_id', 'appointmentId must be a positive integer.');
      return;
    }
    const expectedVersion = Number(req.body?.expectedVersion);
    try {
      await runIdempotent(req, res, session, `hr.staff-appointment.cancel:${appointmentId}`, {
        expectedVersion,
      }, async () => {
        const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
        const data = await withTenantTransaction(db, scope, async (tx) => {
          const result = await cancelStaffAppointmentWithin(
            tx, scope, appointmentId, expectedVersion, session.userId,
          );
          if (result.syncToExternal) {
            await enqueueStaffAppointmentCalendarSyncWithin(tx, scope, {
              appointmentId,
              eventType: 'cancelled',
            });
          }
          await appendAudit(tx, {
            ...scope,
            actorUserId: session.userId,
            requestId: context(res).requestId,
            entity: 'hr/staff-appointments',
            entityId: appointmentId,
            action: 'cancel',
            after: result,
          });
          return result;
        });
        return { status: 200, data };
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/calendar/holidays', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const payload: ManagedHolidayInput = {
      calendarVersionId: Number(req.body?.calendarVersionId),
      holidayDate: typeof req.body?.holidayDate === 'string' ? req.body.holidayDate : '',
      name: typeof req.body?.name === 'string' ? req.body.name : '',
      source: req.body?.source,
      country: typeof req.body?.country === 'string' ? req.body.country : null,
    };
    try {
      await runIdempotent(
        req,
        res,
        session,
        'hr.calendar-holiday.create',
        payload,
        async () => {
          const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
          const data = await withTenantTransaction(db, scope, async (tx) => {
            const result = await createCalendarHolidayDraftWithin(tx, scope, payload);
            await appendAudit(tx, {
              ...scope,
              actorUserId: session.userId,
              requestId: context(res).requestId,
              entity: 'calendar_holiday',
              entityId: result.id,
              action: 'create_draft',
              after: result,
            });
            return result;
          });
          return { status: 201, data };
        },
      );
    } catch (error) {
      handleError(res, error);
    }
  });

  router.put('/calendar/holidays/:holidayId', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const holidayId = employeeIdParam(req.params.holidayId);
    const expectedVersion = Number(req.body?.expectedVersion);
    const payload: ManagedHolidayInput = {
      calendarVersionId: Number(req.body?.calendarVersionId),
      holidayDate: typeof req.body?.holidayDate === 'string' ? req.body.holidayDate : '',
      name: typeof req.body?.name === 'string' ? req.body.name : '',
      source: req.body?.source,
      country: typeof req.body?.country === 'string' ? req.body.country : null,
    };
    if (!holidayId || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
      apiError(res, 400, 'invalid_request', 'holidayId and expectedVersion are required.');
      return;
    }
    try {
      await runIdempotent(
        req,
        res,
        session,
        `hr.calendar-holiday.update:${holidayId}`,
        { holidayId, expectedVersion, ...payload },
        async () => {
          const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
          const data = await withTenantTransaction(db, scope, async (tx) => {
            const result = await updateCalendarHolidayDraftWithin(tx, scope, holidayId, expectedVersion, payload);
            await appendAudit(tx, {
              ...scope,
              actorUserId: session.userId,
              requestId: context(res).requestId,
              entity: 'calendar_holiday',
              entityId: holidayId,
              action: 'update_draft',
              after: result,
            });
            return result;
          });
          return { status: 200, data };
        },
      );
    } catch (error) {
      handleError(res, error);
    }
  });

  for (const action of ['submit', 'approve', 'reject'] as const) {
    router.post(`/calendar/holidays/:holidayId/actions/${action}`, async (req, res) => {
      const session = await requireHr(req, res, PERMISSIONS.hrWrite);
      if (!session) return;
      const holidayId = employeeIdParam(req.params.holidayId);
      const expectedVersion = Number(req.body?.expectedVersion);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
      if (!holidayId || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
        apiError(res, 400, 'invalid_request', 'holidayId and expectedVersion are required.');
        return;
      }
      try {
        await runIdempotent(
          req,
          res,
          session,
          `hr.calendar-holiday.${action}:${holidayId}`,
          { holidayId, expectedVersion, reason },
          async () => {
            const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
            const data = await withTenantTransaction(db, scope, async (tx) => {
              const result = action === 'submit'
                ? await submitCalendarHolidayWithin(tx, scope, holidayId, expectedVersion, session.userId)
                : await decideCalendarHolidayWithin(
                  tx,
                  scope,
                  holidayId,
                  expectedVersion,
                  action,
                  session.userId,
                  reason,
                );
              await appendAudit(tx, {
                ...scope,
                actorUserId: session.userId,
                requestId: context(res).requestId,
                entity: 'calendar_holiday',
                entityId: holidayId,
                action: action === 'submit' ? 'submit_for_approval' : action,
                after: result,
              });
              return result;
            });
            return { status: 200, data };
          },
        );
      } catch (error) {
        handleError(res, error);
      }
    });
  }

  router.get('/staff-onboarding-drafts', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const data = await withTenantTransaction(db, scope, (tx) =>
      listStaffOnboardingDrafts(tx, session));
    res.json({ data, meta: {} });
  });

  router.post('/staff-onboarding-drafts', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    try {
      const data = await createStaffOnboardingDraft(
        db, session, (req.body ?? {}) as StaffOnboardingDraftInput, context(res).requestId,
      );
      res.status(201).json({ data, meta: {} });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.put('/staff-onboarding-drafts/:draftId', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const draftId = employeeIdParam(req.params.draftId);
    const expectedVersion = Number(req.body?.expectedVersion);
    if (!draftId || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
      apiError(res, 400, 'invalid_request', 'draftId and expectedVersion are required.');
      return;
    }
    try {
      const data = await updateStaffOnboardingDraft(
        db,
        session,
        draftId,
        expectedVersion,
        (req.body?.draft ?? {}) as StaffOnboardingDraftInput,
        context(res).requestId,
      );
      res.json({ data, meta: {} });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/staff-onboarding-drafts/:draftId/actions/activate', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const draftId = employeeIdParam(req.params.draftId);
    const expectedVersion = Number(req.body?.expectedVersion);
    const initialPassword = typeof req.body?.initialPassword === 'string'
      ? req.body.initialPassword
      : '';
    if (!draftId || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0
      || (initialPassword.length > 0 && initialPassword.length < 8)) {
      apiError(res, 400, 'invalid_request', 'Draft version and a valid optional initial password are required.', {
        ...(initialPassword.length > 0 && initialPassword.length < 8
          ? { initialPassword: 'Use at least 8 characters.' } : {}),
      });
      return;
    }
    try {
      await runIdempotent(
        req,
        res,
        session,
        'hr.staff-onboarding.activate',
        { draftId, expectedVersion },
        async () => ({
          status: 201,
          data: await activateStaffOnboarding(
            db,
            session,
            draftId,
            expectedVersion,
            initialPassword ? hashPassword(initialPassword) : null,
            context(res).requestId,
          ),
        }),
      );
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/employee-accounts/:employeeId', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const employeeId = employeeIdParam(req.params.employeeId);
    if (!employeeId) {
      apiError(res, 400, 'invalid_id', 'employeeId must be a positive integer.');
      return;
    }
    try {
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      };
      const data = await withTenantTransaction(db, scope, (tx) =>
        readEmployeeAccount(tx, scope, employeeId));
      res.json({ data, meta: {} });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/employee-leave-balances/:employeeId', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const employeeId = employeeIdParam(req.params.employeeId);
    if (!employeeId) {
      apiError(res, 400, 'invalid_id', 'employeeId must be a positive integer.');
      return;
    }
    try {
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      };
      const data = await withTenantTransaction(db, scope, (tx) =>
        projectEmployeeAnnualLeaveWithin(tx, scope, employeeId));
      res.json({ data, meta: { ledger: 'append_only' } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/employee-accounts/:employeeId/actions/create', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    if (!options.tokenEncryptionKey) {
      apiError(res, 503, 'credential_encryption_unavailable', 'Temporary credential encryption is not configured.');
      return;
    }
    const employeeId = employeeIdParam(req.params.employeeId);
    const username = normalizeUsername(typeof req.body?.username === 'string' ? req.body.username : '');
    if (!employeeId || !isValidUsername(username)) {
      apiError(res, 400, 'invalid_request', 'Employee and username are required.', {
        ...(!employeeId ? { employeeId: 'Select a valid employee.' } : {}),
        ...(!isValidUsername(username) ? { username: 'Use 3–64 lowercase letters, digits, dot, dash or underscore.' } : {}),
      });
      return;
    }
    const payload = { employeeId, username };
    try {
      await runIdempotent(req, res, session, 'hr.employee-account.create', payload, async () => {
        const scope = {
          masterFn: session.masterFn,
          companyFn: session.activeCompanyFn,
        };
        const data = await withTenantTransaction(db, scope, (tx) =>
          provisionEmployeeAccount(tx, scope, {
          ...payload,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          }, options.tokenEncryptionKey!));
        return { status: 201, data };
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/employee-accounts/:employeeId/actions/reveal-temporary-password', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    if (!options.tokenEncryptionKey) {
      apiError(res, 503, 'credential_encryption_unavailable', 'Temporary credential encryption is not configured.');
      return;
    }
    const employeeId = employeeIdParam(req.params.employeeId);
    if (!employeeId) {
      apiError(res, 400, 'invalid_id', 'employeeId must be a positive integer.');
      return;
    }
    try {
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      };
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const revealed = await revealEmployeeTemporaryPassword(tx, {
          masterFn: session.masterFn,
          companyFn: session.activeCompanyFn,
        }, employeeId, options.tokenEncryptionKey!);
        await appendAudit(tx, {
          masterFn: session.masterFn,
          companyFn: session.activeCompanyFn,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'employee_account',
          entityId: employeeId,
          action: 'temporary_password_revealed',
          after: {
            userId: revealed.userId,
            purpose: revealed.purpose,
            generation: revealed.generation,
          },
        });
        return revealed;
      });
      res.json({ data, meta: {} });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/employee-accounts/:employeeId/actions/reset-password', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    if (!options.tokenEncryptionKey) {
      apiError(res, 503, 'credential_encryption_unavailable', 'Temporary credential encryption is not configured.');
      return;
    }
    const employeeId = employeeIdParam(req.params.employeeId);
    if (!employeeId) {
      apiError(res, 400, 'invalid_id', 'employeeId must be a positive integer.');
      return;
    }
    try {
      await runIdempotent(req, res, session, 'hr.employee-account.reset', { employeeId }, async () => {
        const scope = {
          masterFn: session.masterFn,
          companyFn: session.activeCompanyFn,
        };
        const data = await withTenantTransaction(db, scope, (tx) =>
          resetEmployeeTemporaryPassword(tx, scope, {
          employeeId,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          }, options.tokenEncryptionKey!));
        return { status: 200, data };
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/employee-accounts/:employeeId/actions/offboard', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const employeeId = employeeIdParam(req.params.employeeId);
    const targetEmployeeId = Number(req.body?.targetEmployeeId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (
      !employeeId
      || !Number.isSafeInteger(targetEmployeeId)
      || targetEmployeeId <= 0
      || reason.length < 3
    ) {
      apiError(res, 400, 'invalid_request', 'Handoff target and reason are required.', {
        ...(!Number.isSafeInteger(targetEmployeeId) || targetEmployeeId <= 0
          ? { targetEmployeeId: 'Select an active employee.' }
          : {}),
        ...(reason.length < 3 ? { reason: 'Enter at least 3 characters.' } : {}),
      });
      return;
    }
    const payload = { employeeId, targetEmployeeId, reason };
    try {
      await runIdempotent(req, res, session, 'hr.employee-account.offboard', payload, async () => {
        const scope = {
          masterFn: session.masterFn,
          companyFn: session.activeCompanyFn,
        };
        const data = await withTenantTransaction(db, scope, (tx) =>
          offboardEmployeeAccount(tx, scope, {
          ...payload,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          }));
        return { status: 200, data };
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/leave-applications/:requestId', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const requestId = employeeIdParam(req.params.requestId);
    if (!requestId) {
      apiError(res, 400, 'invalid_id', 'requestId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) =>
        readGovernedLeaveWithin(
          tx, scope, await managementActor(tx, scope, session.userId), requestId,
        ));
      res.json({ data, meta: { privacy: 'hr_private' } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/leave-approval-queue', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        listMyLeaveApprovalsWithin(
          tx,
          scope,
          session.userId,
          new Date(),
        ));
      res.json({
        data,
        meta: {
          actorDerived: true,
          actionableOnly: true,
          privacy: 'reason_and_evidence_redacted',
          decisionCommands: true,
          limit: 100,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/leave-workflows', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        listLeaveApprovalWorkflowsWithin(tx, scope));
      res.json({
        data,
        meta: {
          companyScoped: true,
          domain: 'leave',
          immutableConfirmedVersions: true,
          statuses: ['draft', 'confirmed', 'retired'],
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/leave-workflows', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const payload = (req.body ?? {}) as LeaveApprovalWorkflowInput;
    try {
      await runIdempotent(
        req,
        res,
        session,
        'hr.leave-workflow.create-draft',
        payload,
        async () => {
          const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
          const data = await withTenantTransaction(db, scope, async (tx) => {
            const result = await createLeaveApprovalWorkflowDraftWithin(tx, scope, payload);
            await appendAudit(tx, {
              ...scope,
              actorUserId: session.userId,
              requestId: context(res).requestId,
              entity: 'approval_policy_version',
              entityId: result.id,
              action: 'draft_created',
              after: {
                code: result.code,
                versionNo: result.versionNo,
                department: result.department,
                typeRef: result.typeRef,
                stepCount: result.steps.length,
              },
            });
            return result;
          });
          return { status: 201, data };
        },
      );
    } catch (error) {
      handleError(res, error);
    }
  });

  for (const action of ['confirm', 'retire'] as const) {
    router.post(`/leave-workflows/:versionId/actions/${action}`, async (req, res) => {
      const session = await requireHr(req, res, PERMISSIONS.hrWrite);
      if (!session) return;
      const versionId = employeeIdParam(req.params.versionId);
      if (!versionId) {
        apiError(res, 400, 'invalid_id', 'versionId must be a positive integer.');
        return;
      }
      try {
        await runIdempotent(
          req,
          res,
          session,
          `hr.leave-workflow.${action}:${versionId}`,
          { versionId },
          async () => {
            const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
            const data = await withTenantTransaction(db, scope, async (tx) => {
              const result = action === 'confirm'
                ? await confirmLeaveApprovalWorkflowWithin(tx, scope, versionId, session.userId)
                : await retireLeaveApprovalWorkflowWithin(tx, scope, versionId);
              await appendAudit(tx, {
                ...scope,
                actorUserId: session.userId,
                requestId: context(res).requestId,
                entity: 'approval_policy_version',
                entityId: versionId,
                action,
                after: {
                  code: result.code,
                  versionNo: result.versionNo,
                  status: result.status,
                },
              });
              return result;
            });
            return { status: 200, data };
          },
        );
      } catch (error) {
        handleError(res, error);
      }
    });
  }

  router.post('/leave-applications', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const payload = {
      employeeId: Number(req.body?.employeeId),
      leaveTypeId: Number(req.body?.leaveTypeId),
      startDate: String(req.body?.startDate ?? ''),
      endDate: String(req.body?.endDate ?? ''),
      unit: String(req.body?.unit ?? ''),
      reason: typeof req.body?.reason === 'string' ? req.body.reason : null,
    };
    if (!Number.isSafeInteger(payload.employeeId) || payload.employeeId <= 0) {
      apiError(res, 400, 'invalid_employee', 'Select a valid employee.');
      return;
    }
    try {
      await runIdempotent(
        req,
        res,
        session,
        'hr.leave.create-on-behalf',
        payload,
        async () => {
          const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
          const data = await withTenantTransaction(db, scope, async (tx) => {
            const result = await createLeaveDraftWithin(
              tx,
              scope,
              await managementActor(tx, scope, session.userId),
              payload.employeeId,
              payload as Parameters<typeof createLeaveDraftWithin>[4],
            );
            await appendAudit(tx, {
              ...scope,
              actorUserId: session.userId,
              requestId: context(res).requestId,
              entity: 'leave_application',
              entityId: result.id,
              action: 'create_on_behalf',
              after: result,
            });
            return result;
          });
          return { status: 201, data };
        },
      );
    } catch (error) {
      handleError(res, error);
    }
  });

  for (const action of ['approve', 'reject', 'void'] as const) {
    router.post(`/leave-applications/:requestId/actions/${action}`, async (req, res) => {
      const session = await requireHr(req, res, PERMISSIONS.hrWrite);
      if (!session) return;
      const requestId = employeeIdParam(req.params.requestId);
      if (!requestId) {
        apiError(res, 400, 'invalid_id', 'requestId must be a positive integer.');
        return;
      }
      const payload = {
        expectedVersion: Number(req.body?.expectedVersion),
        reason: typeof req.body?.reason === 'string' ? req.body.reason : '',
      };
      try {
        await runIdempotent(
          req,
          res,
          session,
          `hr.leave.${action}:${requestId}`,
          payload,
          async () => {
            const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
            const data = await withTenantTransaction(db, scope, async (tx) => {
              const actor = await managementActor(tx, scope, session.userId);
              const result = action === 'void'
                ? await voidLeaveApplicationWithin(
                  tx, scope, actor, requestId, payload.expectedVersion, payload.reason,
                )
                : await decideGovernedLeaveWithin(
                  tx,
                  scope,
                  actor,
                  requestId,
                  payload.expectedVersion,
                  action === 'approve' ? 'approved' : 'rejected',
                  payload.reason,
                );
              await appendAudit(tx, {
                ...scope,
                actorUserId: session.userId,
                requestId: context(res).requestId,
                entity: 'leave_application',
                entityId: requestId,
                action,
                after: result,
              });
              return result;
            });
            return { status: 200, data };
          },
        );
      } catch (error) {
        handleError(res, error);
      }
    });
  }

  for (const action of ['approve', 'reject'] as const) {
    router.post(`/leave-cancellations/:cancellationId/actions/${action}`, async (req, res) => {
      const session = await requireHr(req, res, PERMISSIONS.hrWrite);
      if (!session) return;
      const cancellationId = employeeIdParam(req.params.cancellationId);
      if (!cancellationId) {
        apiError(res, 400, 'invalid_id', 'cancellationId must be a positive integer.');
        return;
      }
      const payload = {
        expectedVersion: Number(req.body?.expectedVersion),
        reason: typeof req.body?.reason === 'string' ? req.body.reason : '',
      };
      try {
        await runIdempotent(
          req,
          res,
          session,
          `hr.leave-cancellation.${action}:${cancellationId}`,
          payload,
          async () => {
            const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
            const data = await withTenantTransaction(db, scope, async (tx) => {
              const result = await decideApprovedLeaveCancellationWithin(
                tx,
                scope,
                await managementActor(tx, scope, session.userId),
                cancellationId,
                payload.expectedVersion,
                action === 'approve' ? 'approved' : 'rejected',
                payload.reason,
              );
              await appendAudit(tx, {
                ...scope,
                actorUserId: session.userId,
                requestId: context(res).requestId,
                entity: 'leave_cancellation',
                entityId: cancellationId,
                action,
                after: result,
              });
              return result;
            });
            return { status: 200, data };
          },
        );
      } catch (error) {
        handleError(res, error);
      }
    });
  }

  return router;
}
