// Demo seed: one master (M1) with a Singapore (GST) and a Malaysia (SST) company,
// currencies, a few products, and effective-dated tax rules (incl. the SG GST 8%→9%
// change so the dated lookup is demonstrable). Same code runs on both adapters.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from './db';
import {
  master, company, currency, appUser, role, rolePermission, userCompany,
  product, taxRule, customer, account, supplier, opportunity, contact, activity, asset,
  employee, leaveRequest, project, progressClaim, serviceContract, serviceTicket,
  purchaseRequisition, purchaseRequisitionLine,
} from './schema';

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

export async function seedDemo(db: DB): Promise<void> {
  await db.insert(master).values({ masterFn: 'M1', name: 'Acme Group' });

  await db.insert(currency).values([
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  ]);

  await db.insert(company).values([
    { companyFn: 'C-SG', masterFn: 'M1', name: 'Acme Singapore', country: 'SG', currency: 'SGD', taxRegime: 'GST', locale: 'en' },
    { companyFn: 'C-MY', masterFn: 'M1', name: 'Acme Malaysia', country: 'MY', currency: 'MYR', taxRegime: 'SST', locale: 'ms' },
  ]);

  // Two demo personas so "switch user" (TASK-024) is meaningful: a superadmin with
  // access to both companies, and a company-scoped viewer with access to SG only.
  const [adminUser] = await db.insert(appUser).values({
    masterFn: 'M1', email: 'admin@acme.co', fullName: 'Admin', passwordHash: ADMIN_PASSWORD_HASH, language: 'zh',
  }).returning({ id: appUser.userId });
  const [viewerUser] = await db.insert(appUser).values({
    masterFn: 'M1', email: 'viewer@acme.co', fullName: 'Demo Viewer', passwordHash: VIEWER_PASSWORD_HASH, language: 'en',
  }).returning({ id: appUser.userId });

  const [superadminRole] = await db.insert(role).values({
    masterFn: 'M1', name: 'Superadmin', isSuperadmin: true,
  }).returning({ id: role.roleId });
  const [viewerRole] = await db.insert(role).values({
    masterFn: 'M1', name: 'Viewer', isSuperadmin: false,
  }).returning({ id: role.roleId });

  await db.insert(userCompany).values([
    { userId: adminUser.id, companyFn: 'C-SG', roleId: superadminRole.id },
    { userId: adminUser.id, companyFn: 'C-MY', roleId: superadminRole.id },
    { userId: viewerUser.id, companyFn: 'C-SG', roleId: viewerRole.id },
  ]);

  await db.insert(rolePermission).values([
    'dashboard.read',
    'inventory.read',
    'sales.read',
    'finance.read',
    'purchasing.read',
    'crm.read',
    'quality.read',
    'asset.read',
    'hr.read',
    'project.read',
    'service.read',
    'session.switch_company',
  ].map((permissionKey) => ({
    masterFn: 'M1',
    roleId: viewerRole.id,
    permissionKey,
  })));

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

  // A supplier for the SG company (TASK-022 — purchasing chain).
  await db.insert(supplier).values({ masterFn: 'M1', companyFn: 'C-SG', code: 'SUPP1', name: 'Gamma Supplies Pte Ltd' });

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
    { masterFn: 'M1', companyFn: 'C-SG', code: '5800', name: 'Inventory Variance', type: 'expense' },
    // Fixed Assets (TASK-035) — codes match the original prototype's own chart of
    // accounts/P&L (data-finance.js), not the inconsistent "6400" its asset-detail
    // screen hardcoded (that code backed nothing in the prototype's own COA either).
    { masterFn: 'M1', companyFn: 'C-SG', code: '1500', name: 'Property, Plant & Equipment', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '1510', name: 'Accumulated Depreciation', type: 'asset' },
    { masterFn: 'M1', companyFn: 'C-SG', code: '6200', name: 'Depreciation Expense', type: 'expense' },
  ]);

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
  }).returning({ id: employee.id });
  const [marcus, aisha, tom, lena] = await db.insert(employee).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeNo: 'EMP-1042', fullName: 'Marcus Silva',
      email: 'marcus.silva@acme.co', department: 'Warehouse', jobTitle: 'Warehouse Supervisor',
      employmentType: 'Full-time', managerId: manager.id, startDate: '2021-03-15', annualLeaveDays: 16,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeNo: 'EMP-1055', fullName: 'Aisha Rahman',
      email: 'aisha.rahman@acme.co', department: 'Finance', jobTitle: 'Senior Accountant',
      employmentType: 'Full-time', managerId: manager.id, startDate: '2020-07-01', annualLeaveDays: 18,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeNo: 'EMP-1071', fullName: 'Tom Becker',
      email: 'tom.becker@acme.co', department: 'Production', jobTitle: 'Production Line Lead',
      employmentType: 'Full-time', managerId: manager.id, startDate: '2022-01-10', annualLeaveDays: 14,
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeNo: 'EMP-1088', fullName: 'Lena Park',
      email: 'lena.park@acme.co', department: 'Sales', jobTitle: 'Account Executive',
      employmentType: 'Contract', managerId: manager.id, startDate: '2023-05-20', annualLeaveDays: 12,
    },
  ]).returning({ id: employee.id });

  await db.insert(leaveRequest).values([
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeId: marcus.id, leaveType: 'Annual',
      startDate: '2026-08-10', endDate: '2026-08-14', days: 5,
      reason: 'Family trip', status: 'pending',
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeId: aisha.id, leaveType: 'Medical',
      startDate: '2026-06-09', endDate: '2026-06-10', days: 2,
      reason: 'Medical appointment', status: 'approved', decidedAt: new Date('2026-06-08T09:00:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeId: tom.id, leaveType: 'Unpaid',
      startDate: '2026-07-01', endDate: '2026-07-05', days: 5,
      reason: 'Personal', status: 'rejected', rejectionReason: 'Peak production week — please reschedule.',
      decidedAt: new Date('2026-06-25T14:30:00Z'),
    },
    {
      masterFn: 'M1', companyFn: 'C-SG', employeeId: lena.id, leaveType: 'Annual',
      startDate: '2026-08-24', endDate: '2026-08-24', days: 1,
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
}

/** True if the demo master already exists (so we can avoid double-seeding). */
export async function isSeeded(db: DB): Promise<boolean> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(master);
  return (rows[0]?.n ?? 0) > 0;
}
