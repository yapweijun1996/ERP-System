// Demo seed: one master (M1) with a Singapore (GST) and a Malaysia (SST) company,
// currencies, a few products, and effective-dated tax rules (incl. the SG GST 8%→9%
// change so the dated lookup is demonstrable). Same code runs on both adapters.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from './db';
import {
  master, company, currency, appUser, role, rolePermission, userCompany, userCompanyRole,
  product, taxRule, customer, account, supplier, opportunity, contact, activity, asset,
  employee, leaveRequest, project, progressClaim, serviceContract, serviceTicket,
  calendarHoliday, leaveBalanceEntry, leavePolicyVersion, leaveType,
  workingCalendar, workingCalendarVersion,
  approvalPolicy, approvalPolicyVersion, approvalPolicyStep, leaveCapacityRule,
  calendarOutboundConnection,
  purchaseRequisition, purchaseRequisitionLine,
  purchaseRfq, purchaseRfqLine, purchaseRfqSupplier,
  supplierQuotation, supplierQuotationLine,
  supplierPriceList, supplierPriceListLine,
  purchaseOrder, purchaseOrderApproval, purchaseOrderLine, supplierInvoice, glEntry,
  payrollRun, payrollRunLine, appNotification,
  integrationConnector, companyPolicy, documentSequence, accountingPeriod,
  financialStatementAccountMap, budgetVersion, budgetLine, consolidationRate,
  companyModule, companyOnboarding, roleResourceScope,
} from './schema';
import { computeStatutoryContributions } from '../modules/payroll/statutory';
import { fixedUnits, fixedString } from '../modules/inventory/decimal';
import { MODULE_KEYS } from '../auth/moduleAccess';

/**
 * Fixed PBKDF2 hashes for the two demo passwords below (see src/auth/password.ts).
 * Pre-computed rather than hashed at seed time so `seedDemo` stays synchronous-shaped
 * and doesn't burn 100k PBKDF2 iterations on every demo boot. Demo passwords are
 * intentionally documented here — this is public sample data, not a real credential.
 *   admin@acme.co  / demo1234
 *   viewer@acme.co / viewer1234
 */
const ADMIN_PASSWORD_HASH = 'pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48';
const VIEWER_PASSWORD_HASH = 'pbkdf2$100000$da9fd51416f6c2fb48c282c0b370bdf1$072cf69c4fb68981cbb43a5af00b11435244a758e0a0ea4b538dd1074fac60a3';
const DEMO_ASSIGNMENT_VALID_FROM = new Date('2026-01-01T00:00:00Z');

export async function seedDemo(db: DB): Promise<void> {
  await db.insert(master).values({ masterFn: 'M1', loginCode: 'ACME', name: 'Acme Group' });

  await db.insert(currency).values([
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  ]);

  await db.insert(company).values([
    { companyFn: 'C-SG', masterFn: 'M1', name: 'Acme Singapore', country: 'SG', currency: 'SGD', taxRegime: 'GST', locale: 'en' },
    { companyFn: 'C-MY', masterFn: 'M1', name: 'Acme Malaysia', country: 'MY', currency: 'MYR', taxRegime: 'SST', locale: 'ms' },
  ]);

  // Keep the compact regression fixture separate from the enterprise showcase pack.
  // Browser Demo startup loads the deterministic pack after this fixture.
  const [adminUser] = await db.insert(appUser).values({
    masterFn: 'M1', username: 'admin', email: 'admin@acme.co', fullName: 'Admin', passwordHash: ADMIN_PASSWORD_HASH, language: 'zh',
  }).returning({ id: appUser.userId });
  const [viewerUser] = await db.insert(appUser).values({
    masterFn: 'M1', username: 'viewer', email: 'viewer@acme.co', fullName: 'Demo Viewer', passwordHash: VIEWER_PASSWORD_HASH, language: 'en',
  }).returning({ id: appUser.userId });
  const [superadminRole] = await db.insert(role).values({
    masterFn: 'M1', name: 'Superadmin', isSuperadmin: true,
  }).returning({ id: role.roleId });
  const [viewerRole] = await db.insert(role).values({
    masterFn: 'M1', name: 'Viewer', isSuperadmin: false,
  }).returning({ id: role.roleId });
  const [employeeRole] = await db.insert(role).values({
    masterFn: 'M1', name: 'Employee', isSuperadmin: false,
  }).returning({ id: role.roleId });
  const [managerRole] = await db.insert(role).values({
    masterFn: 'M1', name: 'Manager', isSuperadmin: false,
  }).returning({ id: role.roleId });
  await db.insert(userCompany).values([
    { userId: adminUser.id, companyFn: 'C-SG', roleId: superadminRole.id },
    { userId: adminUser.id, companyFn: 'C-MY', roleId: superadminRole.id },
    { userId: viewerUser.id, companyFn: 'C-SG', roleId: viewerRole.id },
  ]);
  await db.insert(userCompanyRole).values([
    { userId: adminUser.id, companyFn: 'C-SG', roleId: superadminRole.id, validFrom: DEMO_ASSIGNMENT_VALID_FROM, assignedByUserId: adminUser.id, assignmentSource: 'onboarding' as const },
    { userId: adminUser.id, companyFn: 'C-MY', roleId: superadminRole.id, validFrom: DEMO_ASSIGNMENT_VALID_FROM, assignedByUserId: adminUser.id, assignmentSource: 'onboarding' as const },
    { userId: viewerUser.id, companyFn: 'C-SG', roleId: viewerRole.id, validFrom: DEMO_ASSIGNMENT_VALID_FROM, assignedByUserId: adminUser.id, assignmentSource: 'onboarding' as const },
    { userId: viewerUser.id, companyFn: 'C-SG', roleId: employeeRole.id, validFrom: DEMO_ASSIGNMENT_VALID_FROM, assignedByUserId: adminUser.id, assignmentSource: 'system' as const },
  ]);
  await db.insert(rolePermission).values([
    'dashboard.read', 'inventory.read', 'sales.read', 'finance.read',
    'finance.report.export', 'purchasing.read', 'crm.read', 'manufacturing.read',
    'quality.read', 'asset.read', 'hr.read', 'project.read', 'service.read',
    'reporting.read', 'integration.read', 'notifications.read',
    'notifications.manage', 'session.switch_company',
  ].map((permissionKey) => ({ masterFn: 'M1', roleId: viewerRole.id, permissionKey })));
  await db.insert(rolePermission).values([
    { masterFn: 'M1', roleId: employeeRole.id, permissionKey: 'employee.self.read' },
    { masterFn: 'M1', roleId: employeeRole.id, permissionKey: 'employee.leave.write' },
    { masterFn: 'M1', roleId: employeeRole.id, permissionKey: 'employee.receipts.write' },
    { masterFn: 'M1', roleId: employeeRole.id, permissionKey: 'expenses.company_receipts.read_own' },
    { masterFn: 'M1', roleId: employeeRole.id, permissionKey: 'employee.claims.write' },
    { masterFn: 'M1', roleId: employeeRole.id, permissionKey: 'employee.payout.manage' },
    { masterFn: 'M1', roleId: managerRole.id, permissionKey: 'employee.self.read' },
    { masterFn: 'M1', roleId: managerRole.id, permissionKey: 'employee.leave.write' },
    { masterFn: 'M1', roleId: managerRole.id, permissionKey: 'employee.receipts.write' },
    { masterFn: 'M1', roleId: managerRole.id, permissionKey: 'expenses.company_receipts.read_own' },
    { masterFn: 'M1', roleId: managerRole.id, permissionKey: 'employee.claims.write' },
    { masterFn: 'M1', roleId: managerRole.id, permissionKey: 'employee.payout.manage' },
    { masterFn: 'M1', roleId: managerRole.id, permissionKey: 'employee.team.read' },
    { masterFn: 'M1', roleId: managerRole.id, permissionKey: 'expenses.approve.manager' },
    { masterFn: 'M1', roleId: managerRole.id, permissionKey: 'purchasing.approve' },
  ]);
  await db.insert(roleResourceScope).values([
    { masterFn: 'M1', companyFn: 'C-SG', roleId: viewerRole.id, resourceKey: '*', scope: 'company' },
    { masterFn: 'M1', companyFn: 'C-SG', roleId: employeeRole.id, resourceKey: 'employee/*', scope: 'self' },
    { masterFn: 'M1', companyFn: 'C-SG', roleId: managerRole.id, resourceKey: '*', scope: 'team' },
  ]);
  await db.insert(companyModule).values(
    (['C-SG', 'C-MY'] as const).flatMap((companyFn) => MODULE_KEYS.map((moduleKey) => ({
      masterFn: 'M1', companyFn, moduleKey, enabled: true, configured: true,
    }))),
  );
  await db.insert(companyOnboarding).values((['C-SG', 'C-MY'] as const).map((companyFn) => ({
    masterFn: 'M1', companyFn, status: 'live', currentStage: 'live',
    completedSteps: [
      'company', 'fiscal', 'warehouse', 'modules', 'roles',
      'staff', 'import', 'opening_balance', 'uat',
    ],
    goLiveAt: new Date('2026-07-27T00:00:00Z'), goLiveByUserId: adminUser.id,
  })));

  // First-class, actor-addressed notifications. These rows intentionally stay
  // separate from audit/outbox infrastructure: they model user-visible
  // delivery plus read/dismiss state and prove both user and company isolation.
  await db.insert(appNotification).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', recipientUserId: adminUser.id,
      kind: 'approval_required', severity: 'warning',
      subject: 'Purchase order approval required',
      detail: 'PO-0001 is waiting for your review.', route: 'purchase-orders', entityRef: 'PO-0001',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', recipientUserId: adminUser.id,
      kind: 'inventory_attention', severity: 'critical',
      subject: 'Inventory below reorder point',
      detail: 'SG-WIDGET requires replenishment planning.', route: 'stock-on-hand', entityRef: 'SG-WIDGET',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', recipientUserId: adminUser.id,
      kind: 'system_notice', severity: 'info',
      subject: 'ERP workspace is ready',
      detail: 'Your Singapore company workspace is available.', route: 'dashboard', readAt: new Date('2026-07-19T08:00:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', recipientUserId: viewerUser.id,
      kind: 'system_notice', severity: 'info',
      subject: 'Viewer workspace is ready',
      detail: 'Your read-only Singapore workspace is available.', route: 'dashboard',
    },
    {
      masterFn: 'M1', companyFn: 'C-MY', recipientUserId: adminUser.id,
      kind: 'system_notice', severity: 'success',
      subject: 'Malaysia workspace is ready',
      detail: 'Your Malaysia company workspace is available.', route: 'dashboard',
    },
  ]);

  await db.insert(product).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', sku: 'SG-WIDGET', name: 'Widget (SG)', uom: 'unit',
      category: 'Finished Goods', standardCost: '6.5000', reorderPoint: '20', reorderQty: '100',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', sku: 'SG-GADGET', name: 'Gadget (SG)', uom: 'box',
      category: 'Finished Goods', standardCost: '13.0000', reorderPoint: '10', reorderQty: '50',
    },
    {
      masterFn: 'M1', companyFn: 'C-MY', sku: 'MY-WIDGET', name: 'Widget (MY)', uom: 'unit',
      category: 'Finished Goods', standardCost: '6.0000', reorderPoint: '20', reorderQty: '100',
    },
  ]);

  // SG GST standard-rated: 8% from 2023, 9% from 2024 (effective-dated).
  await db.insert(taxRule).values([
    { masterFn: 'M1', companyFn: 'C-SG', taxRegime: 'GST', taxCode: 'SR', rate: '8.000', validFrom: '2023-01-01', validTo: '2024-01-01' },
    { masterFn: 'M1', companyFn: 'C-SG', taxRegime: 'GST', taxCode: 'SR', rate: '9.000', validFrom: '2024-01-01', validTo: null },
    // MY SST service tax 8%.
    { masterFn: 'M1', companyFn: 'C-MY', taxRegime: 'SST', taxCode: 'SV', rate: '8.000', validFrom: '2025-07-01', validTo: null },
  ]);

  // Canonical control-plane state. Demo connectors never contain a real secret:
  // no-auth connectors are usable; credentialed connectors remain in Setup until
  // configured by the production API with AES-GCM.
  await db.insert(integrationConnector).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', connectorKey: 'customer-csv',
      displayName: 'Customer CSV import', category: 'Data import', direction: 'inbound',
      schedule: 'manual', status: 'connected', health: 'healthy', credentialRequired: false,
      recordsProcessed: 0, enabled: true,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', connectorKey: 'warehouse-webhook',
      displayName: 'Warehouse webhook', category: 'Warehouse', direction: 'outbound',
      schedule: 'realtime', status: 'setup', health: 'unknown', credentialRequired: true,
      endpointHost: 'wms.example.test', recordsProcessed: 0, enabled: false,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', connectorKey: 'bank-statement-csv',
      displayName: 'Bank statement CSV', category: 'Banking', direction: 'inbound',
      schedule: 'manual', status: 'connected', health: 'healthy', credentialRequired: false,
      recordsProcessed: 0, enabled: true,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', connectorKey: 'document-vision',
      displayName: 'Document Vision (BYOK)', category: 'Document processing',
      direction: 'outbound', schedule: 'realtime', status: 'setup', health: 'unknown',
      credentialRequired: true, recordsProcessed: 0, enabled: false,
    },
    {
      masterFn: 'M1', companyFn: 'C-MY', connectorKey: 'customer-csv',
      displayName: 'Customer CSV import', category: 'Data import', direction: 'inbound',
      schedule: 'manual', status: 'connected', health: 'healthy', credentialRequired: false,
      recordsProcessed: 0, enabled: true,
    },
    {
      masterFn: 'M1', companyFn: 'C-MY', connectorKey: 'document-vision',
      displayName: 'Document Vision (BYOK)', category: 'Document processing',
      direction: 'outbound', schedule: 'realtime', status: 'setup', health: 'unknown',
      credentialRequired: true, recordsProcessed: 0, enabled: false,
    },
  ]);

  await db.insert(companyPolicy).values([
    { masterFn: 'M1', companyFn: 'C-SG', approvalThreshold: '50000.00', defaultWarehouseCode: 'WH-SALES' },
    { masterFn: 'M1', companyFn: 'C-MY', dateFormat: 'DD/MM/YYYY', approvalThreshold: '30000.00' },
  ]);
  const sequenceSeed = (companyFn: string, types: Array<[string, string]>) => types.map(([documentType, prefix]) => ({
    masterFn: 'M1', companyFn, documentType, prefix, nextNumber: 1, padding: 4, resetPolicy: 'yearly',
  }));
  await db.insert(documentSequence).values([
    ...sequenceSeed('C-SG', [['sales_order', 'SO'], ['sales_invoice', 'INV'], ['purchase_order', 'PO'], ['journal_entry', 'JE']]),
    ...sequenceSeed('C-MY', [['sales_order', 'SO'], ['sales_invoice', 'INV'], ['purchase_order', 'PO'], ['journal_entry', 'JE']]),
  ]);
  await db.insert(accountingPeriod).values([
    { masterFn: 'M1', companyFn: 'C-SG', fiscalYear: 2026, periodNo: 5, label: 'May 2026', startDate: '2026-05-01', endDate: '2026-05-31', status: 'locked', lockedAt: new Date('2026-06-03T00:00:00Z'), lockedByUserId: adminUser.id },
    { masterFn: 'M1', companyFn: 'C-SG', fiscalYear: 2026, periodNo: 6, label: 'June 2026', startDate: '2026-06-01', endDate: '2026-06-30', status: 'open' },
    { masterFn: 'M1', companyFn: 'C-MY', fiscalYear: 2026, periodNo: 5, label: 'Mei 2026', startDate: '2026-05-01', endDate: '2026-05-31', status: 'locked', lockedAt: new Date('2026-06-03T00:00:00Z'), lockedByUserId: adminUser.id },
    { masterFn: 'M1', companyFn: 'C-MY', fiscalYear: 2026, periodNo: 6, label: 'June 2026', startDate: '2026-06-01', endDate: '2026-06-30', status: 'open' },
  ]);

  // A customer for the SG company.
  const [cust] = await db.insert(customer).values({
    masterFn: 'M1', companyFn: 'C-SG', code: 'CUST1', name: 'Beta Pte Ltd',
    industry: 'Manufacturing', ownerUserId: adminUser.id,
  }).returning({ id: customer.id });

  // Customer-360 contacts + timeline (TASK-031).
  await db.insert(contact).values([
    { masterFn: 'M1', companyFn: 'C-SG', customerId: cust.id, name: 'Priya Nair', role: 'Procurement Manager', email: 'priya.nair@beta.example', phone: '+65 6555 0142' },
    { masterFn: 'M1', companyFn: 'C-SG', customerId: cust.id, name: 'Marcus Tan', role: 'Finance Controller', email: 'marcus.tan@beta.example', phone: null },
  ]);
  await db.insert(activity).values([
    { masterFn: 'M1', companyFn: 'C-SG', customerId: cust.id, kind: 'call', body: 'Discussed Q3 widget supply volumes and lead times.' },
    { masterFn: 'M1', companyFn: 'C-SG', customerId: cust.id, kind: 'note', body: 'Renewed payment terms conversation queued for next QBR.' },
  ]);

  // Two suppliers for the SG company (Purchasing core + competitive RFQ sourcing).
  const [seedSupp1, seedSupp2] = await db.insert(supplier).values([
    { masterFn: 'M1', companyFn: 'C-SG', code: 'SUPP1', name: 'Gamma Supplies Pte Ltd' },
    { masterFn: 'M1', companyFn: 'C-SG', code: 'SUPP2', name: 'Delta Components Pte Ltd' },
  ]).returning({ id: supplier.id });

  // A real active supplier contract for Purchasing Controls. Vendor Performance
  // derives coverage from this row and the actual PO lines; it has no curated KPI seed.
  const [seedWidget] = await db.select({ id: product.id }).from(product).where(and(
    eq(product.masterFn, 'M1'),
    eq(product.companyFn, 'C-SG'),
    eq(product.sku, 'SG-WIDGET'),
  ));
  const [seedSupplierPriceList] = await db.insert(supplierPriceList).values({
    masterFn: 'M1', companyFn: 'C-SG', code: 'SPL-GAMMA-2026',
    name: 'Gamma 2026 widget contract', supplierId: seedSupp1.id,
    currency: 'SGD', status: 'active', version: 2, isPreferred: true,
    leadTimeDays: 7, paymentTerms: '30 days',
    effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31',
  }).returning({ id: supplierPriceList.id });
  await db.insert(supplierPriceListLine).values({
    masterFn: 'M1', companyFn: 'C-SG', priceListId: seedSupplierPriceList.id,
    lineNo: 1, productId: seedWidget.id, minQty: '1.0000', unitCost: '6.0000',
  });

  // An open opportunity for CUST1, owned by the admin user (TASK-027 — CRM chain).
  // Left in 'negotiation' (not converted) so the demo shows an in-flight pipeline
  // deal; converting it is exercised by src/demo.ts's runCrmScenario, not the seed.
  await db.insert(opportunity).values({
    masterFn: 'M1', companyFn: 'C-SG', docNo: 'OPP-1', customerId: cust.id,
    title: 'Widget supply expansion', value: '5000.00', currency: 'SGD',
    stage: 'negotiation', probability: '75.00', closeDate: '2024-06-15', ownerUserId: adminUser.id,
  });

  // Minimal chart of accounts for the SG company (used by sales-order and
  // purchase-order posting).
  await db.insert(account).values([
    { masterFn: 'M1', companyFn: 'C-SG', code: '1100', name: 'Accounts Receivable', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '4000', name: 'Revenue', type: 'income' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '2200', name: 'GST Output Tax', type: 'liability' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '1400', name: 'Inventory', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '1450', name: 'Work in Progress', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '1200', name: 'GST Input Tax', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '2100', name: 'Accounts Payable', type: 'liability' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '2300', name: 'Landed Cost Accrual', type: 'liability' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '5800', name: 'Inventory Variance', type: 'expense' },
    // Fixed Assets (TASK-035) — codes match the original prototype's own chart of
    // accounts/P&L (data-finance.js), not the inconsistent "6400" its asset-detail
    // screen hardcoded (that code backed nothing in the prototype's own COA either).
    { masterFn: 'M1', companyFn: 'C-SG', code: '1500', name: 'Property, Plant & Equipment', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '1510', name: 'Accumulated Depreciation', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '6200', name: 'Depreciation Expense', type: 'expense' },
    // EPIC-024: Bank Receipt/Payment Voucher's Cash/Bank leg. Also the code
    // screens-fin2.js's GL "Cash & bank" tile already reads (previously $0 — no
    // account existed to sum, so this closes a dead frontend tile too).
    { masterFn: 'M1', companyFn: 'C-SG', code: '1000', name: 'Cash & Bank', type: 'asset' },
    // Payroll (EPIC-026).
    { masterFn: 'M1', companyFn: 'C-SG', code: '6100', name: 'Salary & Wages Expense', type: 'expense' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '6110', name: 'Employer Statutory Contributions Expense', type: 'expense' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '2310', name: 'Statutory Contributions Payable', type: 'liability' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '2320', name: 'Income Tax Payable', type: 'liability' },
  ]);

  // Payroll (EPIC-026): C-MY's first chart-of-accounts rows -- until now the
  // Malaysia company had zero accounts (nothing had ever posted GL for it).
  // Scoped to exactly what a payroll run needs to post, matching every other
  // module's precedent of seeding only the accounts its own postings touch.
  await db.insert(account).values([
    { masterFn: 'M1', companyFn: 'C-MY', code: '1000', name: 'Cash & Bank', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-MY', code: '6100', name: 'Salary & Wages Expense', type: 'expense' },
    { masterFn: 'M1', companyFn: 'C-MY', code: '6110', name: 'Employer Statutory Contributions Expense', type: 'expense' },
    { masterFn: 'M1', companyFn: 'C-MY', code: '2310', name: 'Statutory Contributions Payable', type: 'liability' },
    { masterFn: 'M1', companyFn: 'C-MY', code: '2320', name: 'Income Tax Payable', type: 'liability' },
  ]);

  // Financial statement presentation is canonical configuration, not a code-prefix
  // heuristic at query time. Budget lines are natural positive account amounts;
  // the mapping's sign policy controls their contribution to statement totals.
  const reportAccounts = await db.select({
    id: account.id,
    companyFn: account.companyFn,
    code: account.code,
    type: account.type,
  }).from(account).where(eq(account.masterFn, 'M1'));
  await db.insert(financialStatementAccountMap).values(
    reportAccounts
      .filter((row) => row.type === 'income' || row.type === 'expense')
      .map((row) => ({
        masterFn: 'M1',
        companyFn: row.companyFn,
        accountId: row.id,
        section: row.type === 'income'
          ? 'revenue'
          : row.code === '5800'
            ? 'cost_of_sales'
            : 'operating_expense',
        displayOrder: Number(row.code),
        signPolicy: row.type === 'income' ? 'positive' : 'negative',
      })),
  );
  const [sgBudget, myBudget] = await db.insert(budgetVersion).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', fiscalYear: 2026,
      name: 'Approved FY2026 operating budget', currency: 'SGD',
      status: 'approved', isActive: true, version: 2,
      approvedByUserId: adminUser.id, approvedAt: new Date('2026-01-02T00:00:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-MY', fiscalYear: 2026,
      name: 'Approved FY2026 operating budget', currency: 'MYR',
      status: 'approved', isActive: true, version: 2,
      approvedByUserId: adminUser.id, approvedAt: new Date('2026-01-02T00:00:00Z'),
    },
  ]).returning({ id: budgetVersion.id, companyFn: budgetVersion.companyFn });
  const budgetByCompany = new Map([
    [sgBudget.companyFn, sgBudget.id],
    [myBudget.companyFn, myBudget.id],
  ]);
  const demoBudgetByCode: Record<string, Record<string, string>> = {
    'C-SG': {
      '4000': '48000.00',
      '5800': '500.00',
      '6200': '1500.00',
      '6100': '26500.00',
      '6110': '4600.00',
    },
    'C-MY': {
      '6100': '9700.00',
      '6110': '1700.00',
    },
  };
  const budgetRows = reportAccounts.flatMap((row) => {
    const amount = demoBudgetByCode[row.companyFn]?.[row.code];
    const versionId = budgetByCompany.get(row.companyFn);
    return amount && versionId ? [{
      masterFn: 'M1',
      companyFn: row.companyFn,
      budgetVersionId: versionId,
      accountId: row.id,
      periodNo: 6,
      amount,
    }] : [];
  });
  if (budgetRows.length) await db.insert(budgetLine).values(budgetRows);
  await db.insert(consolidationRate).values({
    masterFn: 'M1',
    companyFn: 'C-MY',
    fiscalYear: 2026,
    periodNo: 6,
    fromCurrency: 'MYR',
    toCurrency: 'SGD',
    averageRate: '0.30000000',
    source: 'Fictional approved demo consolidation rate',
    status: 'approved',
    version: 2,
    approvedByUserId: adminUser.id,
    approvedAt: new Date('2026-07-01T00:00:00Z'),
  });

  // Fixed Assets register (TASK-035) — a few seeded assets so the register isn't
  // empty on first boot; none pre-depreciated, so the demo's first "Run depreciation"
  // has real work to do.
  await db.insert(asset).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', assetNo: 'FA-1001', name: 'CNC Milling Machine',
      category: 'Plant & Machinery', location: 'Plant 1 — Bay 3', acquisitionDate: '2023-03-01',
      cost: '420000.00', residualValue: '20000.00', usefulLifeYears: 10, status: 'in_use',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', assetNo: 'FA-1002', name: 'Delivery Van',
      category: 'Vehicles', location: 'Logistics Yard', acquisitionDate: '2024-06-15',
      cost: '68000.00', residualValue: '8000.00', usefulLifeYears: 5, status: 'in_use',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', assetNo: 'FA-1003', name: 'Office Workstations (x12)',
      category: 'IT Equipment', location: 'HQ — Level 3', acquisitionDate: '2025-01-10',
      cost: '18000.00', residualValue: '0.00', usefulLifeYears: 3, status: 'in_use',
    },
  ]);

  // HR-lite (TASK-049): employee master + a few leave requests spanning every real
  // status (pending/approved/rejected) so the demo isn't empty on first boot. Farah
  // Wong has no manager (top of the reporting line); the others report to her,
  // exercising the self-referencing manager_id FK.
  const [manager] = await db.insert(employee).values({
    masterFn: 'M1', companyFn: 'C-SG', employeeNo: 'EMP-1001', fullName: 'Farah Wong',
    email: 'farah.wong@acme.co', department: 'Operations', jobTitle: 'Operations Director',
    employmentType: 'Full-time', startDate: '2019-02-01', annualLeaveDays: 20,
    baseSalary: '8500.00',
  }).returning({ id: employee.id });
  const [marcus, aisha, tom, lena] = await db.insert(employee).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeNo: 'EMP-1042', fullName: 'Marcus Silva',
      email: 'marcus.silva@acme.co', department: 'Warehouse', jobTitle: 'Warehouse Supervisor',
      employmentType: 'Full-time', userId: viewerUser.id, managerId: manager.id,
      startDate: '2021-03-15', annualLeaveDays: 16,
      baseSalary: '4200.00',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeNo: 'EMP-1055', fullName: 'Aisha Rahman',
      email: 'aisha.rahman@acme.co', department: 'Finance', jobTitle: 'Senior Accountant',
      employmentType: 'Full-time', managerId: manager.id, startDate: '2020-07-01', annualLeaveDays: 18,
      baseSalary: '5600.00',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeNo: 'EMP-1071', fullName: 'Tom Becker',
      email: 'tom.becker@acme.co', department: 'Production', jobTitle: 'Production Line Lead',
      employmentType: 'Full-time', managerId: manager.id, startDate: '2022-01-10', annualLeaveDays: 14,
      baseSalary: '4000.00',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeNo: 'EMP-1088', fullName: 'Lena Park',
      email: 'lena.park@acme.co', department: 'Sales', jobTitle: 'Account Executive',
      employmentType: 'Contract', managerId: manager.id, startDate: '2023-05-20', annualLeaveDays: 12,
      baseSalary: '3800.00',
    },
  ]).returning({ id: employee.id });

  // Payroll (EPIC-026): two Malaysia employees so C-MY -- the company whose
  // statutory scheme the payroll mock always demonstrated -- has a real
  // headcount to run payroll for, matching C-SG's above (previously zero, see
  // docs/EPICS.md EPIC-026's research note).
  const [faridMY, sitiMY] = await db.insert(employee).values([
    {
      masterFn: 'M1', companyFn: 'C-MY', employeeNo: 'EMP-2001', fullName: 'Farid Iskandar',
      email: 'farid.iskandar@acme.my', department: 'Warehouse', jobTitle: 'Warehouse Supervisor',
      employmentType: 'Full-time', startDate: '2022-09-01', annualLeaveDays: 16, baseSalary: '5500.00',
    },
    {
      masterFn: 'M1', companyFn: 'C-MY', employeeNo: 'EMP-2002', fullName: 'Siti Balqis',
      email: 'siti.balqis@acme.my', department: 'Sales', jobTitle: 'Sales Executive',
      employmentType: 'Full-time', startDate: '2023-11-15', annualLeaveDays: 14, baseSalary: '4200.00',
    },
  ]).returning({ id: employee.id });

  // TASK-111: confirmed, effective-dated working calendars and leave policies.
  // Imported official holidays intentionally remain draft until HR confirms them;
  // explicit company holidays are confirmed facts immediately.
  const [sgCalendar, myCalendar] = await db.insert(workingCalendar).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'SG-STANDARD',
      name: 'Singapore standard work week', timeZone: 'Asia/Singapore', isDefault: true,
    },
    {
      masterFn: 'M1', companyFn: 'C-MY', code: 'MY-STANDARD',
      name: 'Malaysia standard work week', timeZone: 'Asia/Kuala_Lumpur', isDefault: true,
    },
  ]).returning({ id: workingCalendar.id, companyFn: workingCalendar.companyFn });
  const policyConfirmedAt = new Date('2025-12-01T00:00:00Z');
  const [sgCalendarVersion] = await db.insert(workingCalendarVersion).values({
    masterFn: 'M1', companyFn: 'C-SG', calendarId: sgCalendar.id, versionNo: 1,
    effectiveFrom: '2026-01-01', effectiveTo: null, weekdays: [1, 2, 3, 4, 5],
    status: 'confirmed', confirmedByUserId: adminUser.id, confirmedAt: policyConfirmedAt,
  }).returning({ id: workingCalendarVersion.id });
  await db.insert(workingCalendarVersion).values({
    masterFn: 'M1', companyFn: 'C-MY', calendarId: myCalendar.id, versionNo: 1,
    effectiveFrom: '2026-01-01', effectiveTo: null, weekdays: [1, 2, 3, 4, 5],
    status: 'confirmed', confirmedByUserId: adminUser.id, confirmedAt: policyConfirmedAt,
  });
  await db.insert(calendarHoliday).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', calendarVersionId: sgCalendarVersion.id,
      holidayDate: '2026-08-09', name: 'National Day import', source: 'official',
      country: 'SG', status: 'draft',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', calendarVersionId: sgCalendarVersion.id,
      holidayDate: '2026-12-24', name: 'Company year-end holiday', source: 'company',
      status: 'confirmed', confirmedByUserId: adminUser.id, confirmedAt: policyConfirmedAt,
    },
  ]);
  const leaveTypes = await db.insert(leaveType).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'ANNUAL', name: 'Annual leave', paid: true,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'MEDICAL', name: 'Medical leave', paid: true,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'UNPAID', name: 'Unpaid leave', paid: false,
    },
  ]).returning({ id: leaveType.id, code: leaveType.code });
  const leaveTypeByCode = new Map(leaveTypes.map((type) => [type.code, type.id]));
  const policyVersions = await db.insert(leavePolicyVersion).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', leaveTypeId: leaveTypeByCode.get('ANNUAL')!,
      calendarId: sgCalendar.id, versionNo: 1, effectiveFrom: '2026-01-01',
      status: 'confirmed', unitMode: 'full_and_half_day', annualEntitlementDays: '14.00',
      accrualMethod: 'monthly', carryForwardDays: '5.00', carryExpiryMonths: 3,
      evidenceAfterDays: null, staffingAction: 'warn', minimumStaff: 2,
      encashmentAllowed: true, encashmentMaxDays: '3.00',
      eligibleEmploymentTypes: ['Full-time', 'Part-time'],
      confirmedByUserId: adminUser.id, confirmedAt: policyConfirmedAt,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', leaveTypeId: leaveTypeByCode.get('MEDICAL')!,
      calendarId: sgCalendar.id, versionNo: 1, effectiveFrom: '2026-01-01',
      status: 'confirmed', unitMode: 'full_and_half_day', annualEntitlementDays: '14.00',
      accrualMethod: 'upfront', carryForwardDays: '0.00', evidenceAfterDays: '2.00',
      staffingAction: 'warn', minimumStaff: 0, encashmentAllowed: false,
      encashmentMaxDays: '0.00', eligibleEmploymentTypes: ['Full-time', 'Part-time', 'Contract'],
      confirmedByUserId: adminUser.id, confirmedAt: policyConfirmedAt,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', leaveTypeId: leaveTypeByCode.get('UNPAID')!,
      calendarId: sgCalendar.id, versionNo: 1, effectiveFrom: '2026-01-01',
      status: 'confirmed', unitMode: 'full_and_half_day', annualEntitlementDays: '0.00',
      accrualMethod: 'none', carryForwardDays: '0.00', evidenceAfterDays: null,
      staffingAction: 'extra_approval', minimumStaff: 2, encashmentAllowed: false,
      encashmentMaxDays: '0.00', eligibleEmploymentTypes: ['Full-time', 'Part-time', 'Contract', 'Intern'],
      confirmedByUserId: adminUser.id, confirmedAt: policyConfirmedAt,
    },
  ]).returning({
    id: leavePolicyVersion.id,
    leaveTypeId: leavePolicyVersion.leaveTypeId,
  });
  const policyByLeaveType = new Map(policyVersions.map((policy) => [
    policy.leaveTypeId,
    policy.id,
  ]));
  const annualTypeId = leaveTypeByCode.get('ANNUAL')!;
  const medicalTypeId = leaveTypeByCode.get('MEDICAL')!;
  const approvalPolicies = await db.insert(approvalPolicy).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'LEAVE-DEFAULT',
      name: 'Default leave approval', domain: 'leave',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'LEAVE-LONG',
      name: 'Extended leave approval', domain: 'leave',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'LEAVE-UNPAID',
      name: 'Unpaid leave approval', domain: 'leave',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'EXPENSE-DEFAULT',
      name: 'Default expense line approval', domain: 'expense',
    },
  ]).returning({ id: approvalPolicy.id, code: approvalPolicy.code });
  const approvalPolicyByCode = new Map(approvalPolicies.map((policy) => [
    policy.code,
    policy.id,
  ]));
  const approvalVersions = await db.insert(approvalPolicyVersion).values([
    {
      masterFn: 'M1', companyFn: 'C-SG',
      policyId: approvalPolicyByCode.get('LEAVE-DEFAULT')!,
      versionNo: 1, effectiveFrom: '2026-01-01', status: 'confirmed', priority: 0,
      confirmedByUserId: adminUser.id, confirmedAt: policyConfirmedAt,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG',
      policyId: approvalPolicyByCode.get('LEAVE-LONG')!,
      versionNo: 1, effectiveFrom: '2026-01-01', status: 'confirmed', priority: 100,
      minimumDays: '6.00',
      confirmedByUserId: adminUser.id, confirmedAt: policyConfirmedAt,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG',
      policyId: approvalPolicyByCode.get('LEAVE-UNPAID')!,
      versionNo: 1, effectiveFrom: '2026-01-01', status: 'confirmed', priority: 200,
      typeRef: 'UNPAID',
      confirmedByUserId: adminUser.id, confirmedAt: policyConfirmedAt,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG',
      policyId: approvalPolicyByCode.get('EXPENSE-DEFAULT')!,
      versionNo: 1, effectiveFrom: '2026-01-01', status: 'confirmed', priority: 0,
      confirmedByUserId: adminUser.id, confirmedAt: policyConfirmedAt,
    },
  ]).returning({ id: approvalPolicyVersion.id, policyId: approvalPolicyVersion.policyId });
  const approvalVersionByPolicy = new Map(approvalVersions.map((version) => [
    version.policyId,
    version.id,
  ]));
  const defaultApprovalStep = (policyCode: string, stepNo: number) => ({
    masterFn: 'M1',
    companyFn: 'C-SG',
    policyVersionId: approvalVersionByPolicy.get(approvalPolicyByCode.get(policyCode)!)!,
    stepNo,
    label: stepNo === 1 ? 'Direct manager approval' : 'HR governance approval',
    authorityType: stepNo === 1 ? 'direct_manager' : 'permission',
    authorityPermissionKey: stepNo === 1 ? null : 'hr.write',
    managerLevel: 1,
    fallbackPermissionKey: stepNo === 1 ? 'hr.write' : null,
    reminderAfterHours: stepNo === 1 ? 24 : 48,
    escalateAfterHours: stepNo === 1 ? 48 : null,
    escalationAuthorityType: stepNo === 1 ? 'permission' : null,
    escalationPermissionKey: stepNo === 1 ? 'hr.write' : null,
  });
  await db.insert(approvalPolicyStep).values([
    defaultApprovalStep('LEAVE-DEFAULT', 1),
    defaultApprovalStep('LEAVE-LONG', 1),
    defaultApprovalStep('LEAVE-LONG', 2),
    defaultApprovalStep('LEAVE-UNPAID', 1),
    defaultApprovalStep('LEAVE-UNPAID', 2),
    {
      masterFn: 'M1',
      companyFn: 'C-SG',
      policyVersionId: approvalVersionByPolicy.get(
        approvalPolicyByCode.get('EXPENSE-DEFAULT')!,
      )!,
      stepNo: 1,
      label: 'Direct manager approval',
      authorityType: 'direct_manager',
      managerLevel: 1,
      fallbackPermissionKey: 'expenses.approve.manager',
      reminderAfterHours: 24,
      escalateAfterHours: 48,
      escalationAuthorityType: 'permission',
      escalationPermissionKey: 'expenses.approve.finance',
    },
    {
      masterFn: 'M1',
      companyFn: 'C-SG',
      policyVersionId: approvalVersionByPolicy.get(
        approvalPolicyByCode.get('EXPENSE-DEFAULT')!,
      )!,
      stepNo: 2,
      label: 'Finance evidence, tax and GL approval',
      authorityType: 'permission',
      authorityPermissionKey: 'expenses.approve.finance',
      managerLevel: 1,
      reminderAfterHours: 24,
      escalateAfterHours: 48,
      escalationAuthorityType: 'permission',
      escalationPermissionKey: 'expenses.approve.finance',
    },
  ]);
  await db.insert(leaveCapacityRule).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'CAP-DEFAULT',
      name: 'Default advisory capacity', effectiveFrom: '2026-01-01',
      minimumStaff: 0, action: 'warn', priority: 0,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'CAP-WAREHOUSE-ANNUAL',
      name: 'Warehouse annual-leave warning', department: 'Warehouse', typeRef: 'ANNUAL',
      effectiveFrom: '2026-01-01', minimumStaff: 1, action: 'warn', priority: 100,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'CAP-PRODUCTION-MEDICAL',
      name: 'Production medical-leave block', department: 'Production', typeRef: 'MEDICAL',
      effectiveFrom: '2026-01-01', minimumStaff: 1, action: 'block', priority: 100,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', code: 'CAP-UNPAID-EXCEPTION',
      name: 'Unpaid leave capacity exception', typeRef: 'UNPAID',
      effectiveFrom: '2026-01-01', minimumStaff: 1, action: 'extra_approval', priority: 90,
      extraApprovalPermissionKey: 'hr.write',
    },
  ]);
  await db.insert(calendarOutboundConnection).values({
    masterFn: 'M1',
    companyFn: 'C-SG',
    name: 'Demo team availability calendar',
    provider: 'generic',
    calendarRef: 'demo-team-availability',
    createdByUserId: adminUser.id,
  });
  const sgEmployees = [
    [manager.id, 20],
    [marcus.id, 16],
    [aisha.id, 18],
    [tom.id, 14],
    [lena.id, 12],
  ] as const;
  await db.insert(leaveBalanceEntry).values(sgEmployees.flatMap(([employeeId, annualDays]) => [
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeId, leaveTypeId: annualTypeId,
      policyVersionId: policyByLeaveType.get(annualTypeId)!,
      entryType: 'grant', entryKey: `demo:2026:annual:${employeeId}`,
      balanceDelta: annualDays.toFixed(2), reservedDelta: '0.00',
      effectiveDate: '2026-01-01', sourceType: 'demo_opening_grant',
      sourceId: `annual:${employeeId}`, createdByUserId: adminUser.id,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeId, leaveTypeId: medicalTypeId,
      policyVersionId: policyByLeaveType.get(medicalTypeId)!,
      entryType: 'grant', entryKey: `demo:2026:medical:${employeeId}`,
      balanceDelta: '14.00', reservedDelta: '0.00',
      effectiveDate: '2026-01-01', sourceType: 'demo_opening_grant',
      sourceId: `medical:${employeeId}`, createdByUserId: adminUser.id,
    },
  ]));

  await db.insert(leaveRequest).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeId: marcus.id, leaveType: 'Annual',
      startDate: '2026-08-10', endDate: '2026-08-14', days: '5.00',
      reason: 'Family trip', status: 'pending',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeId: aisha.id, leaveType: 'Medical',
      startDate: '2026-06-09', endDate: '2026-06-10', days: '2.00',
      reason: 'Medical appointment', status: 'approved', decidedAt: new Date('2026-06-08T09:00:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeId: tom.id, leaveType: 'Unpaid',
      startDate: '2026-07-01', endDate: '2026-07-05', days: '5.00',
      reason: 'Personal', status: 'rejected', rejectionReason: 'Peak production week — please reschedule.',
      decidedAt: new Date('2026-06-25T14:30:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeId: lena.id, leaveType: 'Annual',
      startDate: '2026-08-24', endDate: '2026-08-24', days: '1.00',
      reason: 'Errand', status: 'pending',
    },
  ]);

  // Project-lite (TASK-051): a customer-billed project plus two internal ones (no
  // customer, so they can never receive a progress claim — enforced by
  // createProgressClaimWithin). Nothing is pre-posted, matching Fixed Assets'
  // precedent (TASK-035) of leaving the first "Post" a live, real first action
  // rather than fabricating GL history by hand in the seed.
  const [cellProject] = await db.insert(project).values({
    masterFn: 'M1', companyFn: 'C-SG', projectNo: 'PRJ-2026-001',
    name: 'Beta Pte Ltd — Automation Cell Integration', customerId: cust.id,
    managerName: 'Liam Cardoso', status: 'open',
    startDate: '2026-03-04', dueDate: '2026-08-15', contractValue: '486000.00',
  }).returning({ id: project.id });
  await db.insert(project).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', projectNo: 'PRJ-2026-002',
      name: 'Plant 2 Automation Retrofit', customerId: null,
      managerName: 'Wei Ling Tan', status: 'on_hold',
      startDate: '2026-04-18', dueDate: '2026-11-30', contractValue: '720000.00',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', projectNo: 'PRJ-2026-003',
      name: 'Service Fleet Telematics Upgrade', customerId: null,
      managerName: 'Rosa Delgado', status: 'open',
      startDate: '2026-05-06', dueDate: '2026-09-20', contractValue: '96000.00',
    },
  ]);

  // Two draft progress claims against the customer-billed project (9% SG GST,
  // matching the taxRule row above) so the demo's progress-claims panel and
  // "Post" action have real work to do on first use.
  await db.insert(progressClaim).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', docNo: 'PC-2026-0001', projectId: cellProject.id,
      claimDate: '2026-04-12', description: 'Design & sign-off',
      netAmount: '92000.00', taxCode: 'SR', taxRate: '9.000',
      taxAmount: '8280.00', totalAmount: '100280.00',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', docNo: 'PC-2026-0002', projectId: cellProject.id,
      claimDate: '2026-05-20', description: 'Fabrication 50% complete',
      netAmount: '138000.00', taxCode: 'SR', taxRate: '9.000',
      taxAmount: '12420.00', totalAmount: '150420.00',
    },
  ]);

  // Service-lite (TASK-053): a Gold contract (active) and a Silver contract expiring
  // soon, plus three tickets spanning every real status/coverage combination — one
  // open/unassigned, one in_progress/assigned, one closed with a real diagnosis.
  const [goldContract] = await db.insert(serviceContract).values({
    masterFn: 'M1', companyFn: 'C-SG', contractNo: 'SC-2026-0001', customerId: cust.id,
    plan: 'Gold', slaResponseHours: 4, assetsCovered: 6,
    startDate: '2025-04-01', expiryDate: '2027-03-31', annualValue: '48000.00',
  }).returning({ id: serviceContract.id });
  await db.insert(serviceContract).values({
    masterFn: 'M1', companyFn: 'C-SG', contractNo: 'SC-2026-0002', customerId: cust.id,
    plan: 'Silver', slaResponseHours: 24, assetsCovered: 3,
    startDate: '2024-06-01', expiryDate: '2026-08-15', annualValue: '18000.00',
  });

  await db.insert(serviceTicket).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', ticketNo: 'SVC-2026-0001', customerId: cust.id,
      contractId: null, assetDescription: 'Conveyor Drive Unit', serialNo: 'CDU-2291',
      issue: 'Drive unit overheating, intermittent stop', priority: 'High',
      coverage: 'in_warranty', status: 'in_progress', technicianName: 'Kwame Mensah',
      openedAt: new Date('2026-07-18T08:10:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', ticketNo: 'SVC-2026-0002', customerId: cust.id,
      contractId: goldContract.id, assetDescription: 'Packaging Line — Model X',
      serialNo: 'PLX-0033', issue: 'Sensor calibration drift on infeed', priority: 'Medium',
      coverage: 'contract', status: 'open',
      openedAt: new Date('2026-07-19T10:30:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', ticketNo: 'SVC-2026-0003', customerId: cust.id,
      contractId: null, assetDescription: 'Carton Former CF-200', serialNo: 'CF-0091',
      issue: 'Drive belt replacement', priority: 'Medium', coverage: 'out_of_warranty',
      status: 'closed', technicianName: 'Rosa Diaz',
      diagnosis: 'Replaced worn drive belt and tested through 3 full cycles; running normally.',
      openedAt: new Date('2026-07-10T09:00:00Z'), resolvedAt: new Date('2026-07-12T14:20:00Z'),
    },
  ]);

  // Purchase Requisition (TASK-055): 3 requisitions spanning every real status,
  // against the real seeded SG products, so the demo's "Convert to PO" action has a
  // real approved requisition ready to use on first load. Nothing is pre-converted --
  // matching Fixed Assets/Service's precedent of leaving the first real conversion a
  // live action.
  const [sgWidget] = await db.select({ id: product.id }).from(product).where(and(
    eq(product.masterFn, 'M1'), eq(product.companyFn, 'C-SG'), eq(product.sku, 'SG-WIDGET'),
  ));
  const [sgGadget] = await db.select({ id: product.id }).from(product).where(and(
    eq(product.masterFn, 'M1'), eq(product.companyFn, 'C-SG'), eq(product.sku, 'SG-GADGET'),
  ));

  const [prSubmitted] = await db.insert(purchaseRequisition).values({
    masterFn: 'M1', companyFn: 'C-SG', reqNo: 'PR-2026-0001',
    requestedByName: 'Marcus Silva', department: 'Warehouse',
    neededByDate: '2026-08-10', priority: 'Stock', status: 'submitted',
    estimatedValue: '325.00',
  }).returning({ id: purchaseRequisition.id });
  const [prApproved] = await db.insert(purchaseRequisition).values({
    masterFn: 'M1', companyFn: 'C-SG', reqNo: 'PR-2026-0002',
    requestedByName: 'Tom Becker', department: 'Production',
    neededByDate: '2026-08-05', priority: 'Urgent',
    justification: 'Line 2 blocked without replacement gadgets — production halted since Monday.',
    status: 'approved', decidedAt: new Date('2026-07-19T09:15:00Z'),
    estimatedValue: '1430.00',
  }).returning({ id: purchaseRequisition.id });
  const [prRejected] = await db.insert(purchaseRequisition).values({
    masterFn: 'M1', companyFn: 'C-SG', reqNo: 'PR-2026-0003',
    requestedByName: 'Lena Park', department: 'Sales',
    neededByDate: '2026-08-20', priority: 'Project',
    justification: 'Client demo kit for Q3 roadshow.',
    status: 'rejected', rejectionReason: "Not in this quarter's demo budget — resubmit in Q4.",
    decidedAt: new Date('2026-07-18T16:00:00Z'),
    estimatedValue: '65.00',
  }).returning({ id: purchaseRequisition.id });

  await db.insert(purchaseRequisitionLine).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', requisitionId: prSubmitted.id, lineNo: 1,
      productId: sgWidget.id, qty: '50', estimatedUnitCost: '6.50',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', requisitionId: prApproved.id, lineNo: 1,
      productId: sgGadget.id, qty: '100', estimatedUnitCost: '13.00',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', requisitionId: prApproved.id, lineNo: 2,
      productId: sgWidget.id, qty: '20', estimatedUnitCost: '6.50',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', requisitionId: prRejected.id, lineNo: 1,
      productId: sgGadget.id, qty: '5', estimatedUnitCost: '13.00',
    },
  ]);

  // RFQ sourcing: an issued ad-hoc request with one of two invited suppliers already
  // responded. This leaves the second response + award as a real live demo flow.
  const [seedRfq] = await db.insert(purchaseRfq).values({
    masterFn: 'M1', companyFn: 'C-SG', docNo: 'RFQ-2026-0001',
    subject: 'Widget replenishment sourcing', rfqDate: '2026-07-18',
    responseDueDate: '2026-08-15', status: 'sent', version: 2,
  }).returning({ id: purchaseRfq.id });
  const [seedRfqLine] = await db.insert(purchaseRfqLine).values({
    masterFn: 'M1', companyFn: 'C-SG', rfqId: seedRfq.id, lineNo: 1,
    productId: sgWidget.id, qty: '50',
  }).returning({ id: purchaseRfqLine.id });
  await db.insert(purchaseRfqSupplier).values([
    { masterFn: 'M1', companyFn: 'C-SG', rfqId: seedRfq.id, supplierId: seedSupp1.id },
    { masterFn: 'M1', companyFn: 'C-SG', rfqId: seedRfq.id, supplierId: seedSupp2.id },
  ]);
  const [seedQuote] = await db.insert(supplierQuotation).values({
    masterFn: 'M1', companyFn: 'C-SG', docNo: 'SQ-2026-0001',
    rfqId: seedRfq.id, supplierId: seedSupp1.id,
    quoteDate: '2026-07-20', validUntil: '2026-09-15', currency: 'SGD',
    leadTimeDays: 10, paymentTerms: 'Net 30', warranty: '12 months',
    status: 'received', netAmount: '350.00', taxAmount: '31.50', totalAmount: '381.50',
  }).returning({ id: supplierQuotation.id });
  await db.insert(supplierQuotationLine).values({
    masterFn: 'M1', companyFn: 'C-SG', quotationId: seedQuote.id,
    rfqLineId: seedRfqLine.id, lineNo: 1, productId: sgWidget.id,
    qty: '50', unitCost: '7.0000', netAmount: '350.00',
    taxCode: 'SR', taxRate: '9.000', taxAmount: '31.50',
  });

  // EPIC-024 (TASK-058): a real received PO + unpaid supplier invoice tagged to the
  // project below (project_id, threaded automatically the same way
  // postSupplierInvoiceWithin does it for real), so Payment Voucher and the
  // project's Project-costs panel both have something real on first load. A real
  // posted (third) progress claim gives Bank Receipt something real to collect.
  // Neither is pre-paid/pre-receipted -- matching the established precedent of
  // leaving the first real conversion a live action (e.g. Purchase Requisition's
  // approved-but-unconverted seed row).
  async function acctId(code: string, companyFn = 'C-SG') {
    const [row] = await db.select({ id: account.id }).from(account).where(and(
      eq(account.masterFn, 'M1'), eq(account.companyFn, companyFn), eq(account.code, code),
    ));
    return row.id;
  }
  const [supp1] = await db.select({ id: supplier.id }).from(supplier).where(and(
    eq(supplier.masterFn, 'M1'), eq(supplier.companyFn, 'C-SG'), eq(supplier.code, 'SUPP1'),
  ));

  const [poFin1] = await db.insert(purchaseOrder).values({
    masterFn: 'M1', companyFn: 'C-SG', docNo: 'PO-2026-0001', supplierId: supp1.id,
    projectId: cellProject.id, status: 'received', orderDate: '2026-06-01', currency: 'SGD',
    netAmount: '1000.00', taxAmount: '90.00', totalAmount: '1090.00',
  }).returning({ id: purchaseOrder.id });
  await db.insert(purchaseOrderLine).values({
    masterFn: 'M1', companyFn: 'C-SG', orderId: poFin1.id, lineNo: 1,
    productId: sgWidget.id, qty: '100', unitCost: '10.00',
    netAmount: '1000.00', taxCode: 'SR', taxRate: '9.000', taxAmount: '90.00',
  });

  // TASK-068: one genuine pending PO makes the approval queue immediately useful.
  // It has no receipt, stock movement, invoice or GL entries; those remain blocked
  // until an authorised user records a real decision.
  const [approvalPo] = await db.insert(purchaseOrder).values({
    masterFn: 'M1', companyFn: 'C-SG', docNo: 'PO-APP-2026-0001', supplierId: supp1.id,
    status: 'pending_approval', orderDate: '2026-07-20', currency: 'SGD',
    netAmount: '350.00', taxAmount: '31.50', totalAmount: '381.50',
  }).returning({ id: purchaseOrder.id });
  await db.insert(purchaseOrderLine).values({
    masterFn: 'M1', companyFn: 'C-SG', orderId: approvalPo.id, lineNo: 1,
    productId: sgWidget.id, qty: '50', unitCost: '7.0000',
    netAmount: '350.00', taxCode: 'SR', taxRate: '9.000', taxAmount: '31.50',
  });
  await db.insert(purchaseOrderApproval).values({
    masterFn: 'M1', companyFn: 'C-SG', orderId: approvalPo.id, status: 'pending',
  });
  await db.insert(supplierInvoice).values({
    masterFn: 'M1', companyFn: 'C-SG', docNo: 'SINV-2026-0001', orderId: poFin1.id,
    supplierId: supp1.id, projectId: cellProject.id, status: 'unpaid',
    invoiceDate: '2026-06-05', currency: 'SGD',
    netAmount: '1000.00', taxAmount: '90.00', totalAmount: '1090.00',
  });
  await db.insert(glEntry).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', journalRef: 'SINV-2026-0001',
      accountId: await acctId('1400'), debit: '1000.00', credit: '0', memo: 'Inventory',
      postedAt: new Date('2026-06-05T09:00:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', journalRef: 'SINV-2026-0001',
      accountId: await acctId('1200'), debit: '90.00', credit: '0', memo: 'Input tax',
      postedAt: new Date('2026-06-05T09:00:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', journalRef: 'SINV-2026-0001',
      accountId: await acctId('2100'), debit: '0', credit: '1090.00', memo: 'AP',
      postedAt: new Date('2026-06-05T09:00:00Z'),
    },
  ]);

  await db.insert(progressClaim).values({
    masterFn: 'M1', companyFn: 'C-SG', docNo: 'PC-2026-0003', projectId: cellProject.id,
    status: 'posted', claimDate: '2026-06-25', description: 'Commissioning & handover',
    netAmount: '50000.00', taxCode: 'SR', taxRate: '9.000',
    taxAmount: '4500.00', totalAmount: '54500.00',
  });
  await db.insert(glEntry).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', journalRef: 'PC-2026-0003',
      accountId: await acctId('1100'), debit: '54500.00', credit: '0', memo: 'AR progress claim',
      postedAt: new Date('2026-06-25T10:00:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', journalRef: 'PC-2026-0003',
      accountId: await acctId('4000'), debit: '0', credit: '50000.00', memo: 'Progress claim revenue',
      postedAt: new Date('2026-06-25T10:00:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', journalRef: 'PC-2026-0003',
      accountId: await acctId('2200'), debit: '0', credit: '4500.00', memo: 'Output tax',
      postedAt: new Date('2026-06-25T10:00:00Z'),
    },
  ]);
  await db.update(project).set({
    billedToDate: sql`${project.billedToDate} + 50000.00`,
  }).where(and(eq(project.masterFn, 'M1'), eq(project.companyFn, 'C-SG'), eq(project.id, cellProject.id)));

  // Payroll (EPIC-026): one posted run per company so a real payslip is
  // viewable immediately in both Singapore and Malaysia without first
  // creating a run -- unlike Fixed Assets' deliberately-unposted depreciation
  // runs, a payslip screen with nothing posted has nothing to show at all.
  // Uses the real computeStatutoryContributions() so seed figures can never
  // drift from what createPayrollRun/postPayrollRun would themselves compute.
  async function seedPayrollRun(
    companyFn: string,
    country: 'SG' | 'MY',
    docNo: string,
    period: { start: string; end: string; payDate: string; postedAt: Date },
    lines: { employeeId: number; baseSalary: string }[],
  ) {
    const computed = lines.map((line) => ({
      ...line,
      ...computeStatutoryContributions(country, line.baseSalary),
    }));
    const totalGrossCents = computed.reduce((sum, l) => sum + fixedUnits(l.baseSalary, 2), 0n);
    const totalNetCents = computed.reduce((sum, l) => sum + fixedUnits(l.netPay, 2), 0n);
    const employeeStatutoryCents = computed
      .reduce((sum, l) => sum + fixedUnits(l.employeeStatutoryDeduction, 2), 0n);
    const employerStatutoryCents = computed
      .reduce((sum, l) => sum + fixedUnits(l.employerStatutoryContribution, 2), 0n);
    const employerAdditionalCents = computed
      .reduce((sum, l) => sum + fixedUnits(l.employerAdditionalContribution, 2), 0n);
    const incomeTaxCents = computed.reduce((sum, l) => sum + fixedUnits(l.incomeTaxDeduction, 2), 0n);
    const employerContributionCents = employerStatutoryCents + employerAdditionalCents;
    const statutoryPayableCents = employeeStatutoryCents + employerContributionCents;

    const [run] = await db.insert(payrollRun).values({
      masterFn: 'M1', companyFn, docNo, status: 'posted',
      periodStart: period.start, periodEnd: period.end, payDate: period.payDate,
      totalGrossPay: fixedString(totalGrossCents, 2), totalNetPay: fixedString(totalNetCents, 2),
      postedAt: period.postedAt,
    }).returning({ id: payrollRun.id });

    await db.insert(payrollRunLine).values(computed.map((line, index) => ({
      masterFn: 'M1', companyFn, runId: run.id, lineNo: index + 1, employeeId: line.employeeId,
      baseGrossPay: line.baseSalary,
      grossPay: line.baseSalary,
      employeeStatutoryDeduction: line.employeeStatutoryDeduction,
      incomeTaxDeduction: line.incomeTaxDeduction,
      employerStatutoryContribution: line.employerStatutoryContribution,
      employerAdditionalContribution: line.employerAdditionalContribution,
      netPay: line.netPay,
    })));

    const legs = [
      {
        accountId: await acctId('6100', companyFn),
        debit: fixedString(totalGrossCents, 2), credit: '0', memo: 'Salary & wages expense',
      },
      {
        accountId: await acctId('6110', companyFn),
        debit: fixedString(employerContributionCents, 2), credit: '0',
        memo: 'Employer statutory contributions expense',
      },
      {
        accountId: await acctId('2310', companyFn),
        debit: '0', credit: fixedString(statutoryPayableCents, 2),
        memo: 'Statutory contributions payable (employee + employer)',
      },
      ...(incomeTaxCents > 0n ? [{
        accountId: await acctId('2320', companyFn),
        debit: '0', credit: fixedString(incomeTaxCents, 2), memo: 'Income tax payable',
      }] : []),
      {
        accountId: await acctId('1000', companyFn),
        debit: '0', credit: fixedString(totalNetCents, 2), memo: 'Net pay disbursed',
      },
    ];
    await db.insert(glEntry).values(legs.map((leg) => ({
      masterFn: 'M1', companyFn, journalRef: docNo, ...leg,
    })));
  }

  await seedPayrollRun(
    'C-SG', 'SG', 'PAY-2026-0001',
    { start: '2026-06-01', end: '2026-06-30', payDate: '2026-06-28', postedAt: new Date('2026-06-28T10:00:00Z') },
    [
      { employeeId: manager.id, baseSalary: '8500.00' },
      { employeeId: marcus.id, baseSalary: '4200.00' },
      { employeeId: aisha.id, baseSalary: '5600.00' },
      { employeeId: tom.id, baseSalary: '4000.00' },
      { employeeId: lena.id, baseSalary: '3800.00' },
    ],
  );
  await seedPayrollRun(
    'C-MY', 'MY', 'PAY-2026-0001',
    { start: '2026-06-01', end: '2026-06-30', payDate: '2026-06-28', postedAt: new Date('2026-06-28T10:00:00Z') },
    [
      { employeeId: faridMY.id, baseSalary: '5500.00' },
      { employeeId: sitiMY.id, baseSalary: '4200.00' },
    ],
  );
}

/** True if the demo master already exists (so we can avoid double-seeding). */
export async function isSeeded(db: DB): Promise<boolean> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(master);
  return (rows[0]?.n ?? 0) > 0;
}
