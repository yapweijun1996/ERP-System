import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from './schema';
import { seedDemo } from './seed';
import { projectEmployeeAnnualLeaveWithin } from '../modules/hr/leaveBalance';
import { ROLE_TEMPLATES } from '../auth/accessCatalog';

describe('deterministic enterprise Demo pack', () => {
  it('verifies SHA-256, fixed counts, references and balanced journals', async () => {
    const [schemaSql, packSql, receiptFixtureSql, manifestText] = await Promise.all([
      readFile('web/public/db/erp-system-schema.sql', 'utf8'),
      readFile('web/public/db/erp-system-showcase-v1.sql', 'utf8'),
      readFile('web/public/db/erp-system-demo-company-receipts.sql', 'utf8'),
      readFile('web/public/db/erp-system-showcase-v1.json', 'utf8'),
    ]);
    const manifest = JSON.parse(manifestText) as {
      version: string;
      personas: number;
      sha256: string;
      records: {
        activities: number; stockMovements: number; glEntries: number;
        leaveRequests: number; leaveBalanceEntries: number;
        payrollRuns: number; payrollLines: number;
        salesOrders: number; salesOrderLines: number; salesOrderApprovals: number;
        purchaseOrders: number; purchaseOrderLines: number; goodsReceipts: number;
        apStockMovements: number; supplierInvoices: number; apGlEntries: number;
        total: number;
      };
    };
    expect(manifest.version).toBe('15');
    expect(manifest.personas).toBe(12);
    expect(createHash('sha256').update(packSql).digest('hex')).toBe(manifest.sha256);
    const client = new PGlite();
    await client.exec(schemaSql);
    const db = drizzle(client, { schema });
    await seedDemo(db);
    await client.exec(packSql);
    await client.exec(receiptFixtureSql);
    const counts = (await client.query<{
      activities: number; movements: number; gl_entries: number;
      leave_requests: number; leave_balance_entries: number;
      payroll_runs: number; payroll_lines: number;
      sales_orders: number; sales_order_lines: number; sales_order_approvals: number;
      purchase_orders: number; purchase_order_lines: number; goods_receipts: number;
      ap_stock_movements: number; supplier_invoices: number; ap_gl_entries: number;
    }>(`
      select
        (select count(*)::int from activity where body like 'Deterministic showcase activity %') as activities,
        (select count(*)::int from stock_movement where ref_type in ('demo_pack','demo_sales_approval')) as movements,
        (select count(*)::int from gl_entry where journal_ref like 'DEMO-JE-%') as gl_entries,
        (select count(*)::int from leave_request where reason like 'Controlled demo leave case %') as leave_requests,
        (select count(*)::int from leave_balance_entry where source_type in ('demo_showcase_opening','demo_showcase_leave_request')) as leave_balance_entries,
        (select count(*)::int from payroll_run where doc_no like 'DEMO-PAY-%') as payroll_runs,
        (select count(*)::int from payroll_run_line line join payroll_run run on run.id=line.run_id where run.doc_no like 'DEMO-PAY-%') as payroll_lines,
        (select count(*)::int from sales_order where doc_no like 'DEMO-SO-APP-%') as sales_orders,
        (select count(*)::int from sales_order_line line join sales_order orders on orders.id=line.order_id where orders.doc_no like 'DEMO-SO-APP-%') as sales_order_lines,
        (select count(*)::int from sales_order_approval approval join sales_order orders on orders.id=approval.order_id where orders.doc_no like 'DEMO-SO-APP-%') as sales_order_approvals,
        (select count(*)::int from purchase_order where doc_no like 'DEMO-AP-PO-%') as purchase_orders,
        (select count(*)::int from purchase_order_line line join purchase_order po on po.id=line.order_id where po.doc_no like 'DEMO-AP-PO-%') as purchase_order_lines,
        (select count(*)::int from goods_receipt where doc_no like 'DEMO-AP-GR-%') as goods_receipts,
        (select count(*)::int from stock_movement where movement_group like 'DEMO-AP-RECEIPT-%') as ap_stock_movements,
        (select count(*)::int from supplier_invoice where doc_no like 'DEMO-AP-INV-%') as supplier_invoices,
        (select count(*)::int from gl_entry where journal_ref like 'DEMO-AP-INV-%') as ap_gl_entries
    `)).rows[0];
    expect(Number(counts.leave_requests)).toBe(manifest.records.leaveRequests);
    expect(Number(counts.leave_balance_entries)).toBe(manifest.records.leaveBalanceEntries);
    expect(Number(counts.payroll_runs)).toBe(manifest.records.payrollRuns);
    expect(Number(counts.payroll_lines)).toBe(manifest.records.payrollLines);
    expect(Number(counts.sales_orders)).toBe(manifest.records.salesOrders);
    expect(Number(counts.sales_order_lines)).toBe(manifest.records.salesOrderLines);
    expect(Number(counts.sales_order_approvals)).toBe(manifest.records.salesOrderApprovals);
    expect(Number(counts.purchase_orders)).toBe(manifest.records.purchaseOrders);
    expect(Number(counts.purchase_order_lines)).toBe(manifest.records.purchaseOrderLines);
    expect(Number(counts.goods_receipts)).toBe(manifest.records.goodsReceipts);
    expect(Number(counts.ap_stock_movements)).toBe(manifest.records.apStockMovements);
    expect(Number(counts.supplier_invoices)).toBe(manifest.records.supplierInvoices);
    expect(Number(counts.ap_gl_entries)).toBe(manifest.records.apGlEntries);
    expect(Number(counts.activities) + Number(counts.movements) + Number(counts.gl_entries)
      + Number(counts.leave_requests) + Number(counts.leave_balance_entries)
      + Number(counts.payroll_runs) + Number(counts.payroll_lines)
      + Number(counts.sales_orders) + Number(counts.sales_order_lines)
      + Number(counts.sales_order_approvals)
      + Number(counts.purchase_orders) + Number(counts.purchase_order_lines)
      + Number(counts.goods_receipts) + Number(counts.ap_stock_movements)
      + Number(counts.supplier_invoices) + Number(counts.ap_gl_entries))
      .toBe(manifest.records.total);
    const unbalanced = (await client.query(`
      select journal_ref from gl_entry where journal_ref like 'DEMO-JE-%'
      group by master_fn,company_fn,journal_ref
      having abs(sum(debit)-sum(credit)) > 0.005
    `)).rows;
    expect(unbalanced).toHaveLength(0);
    const unbalancedAp = (await client.query(`
      select journal_ref from gl_entry where journal_ref like 'DEMO-AP-INV-%'
      group by master_fn,company_fn,journal_ref
      having abs(sum(debit)-sum(credit)) > 0.005
    `)).rows;
    expect(unbalancedAp).toHaveLength(0);
    const unusableApCases = (await client.query(`
      select company.company_fn
      from (values ('C-SG'),('C-MY')) company(company_fn)
      left join supplier_invoice invoice on invoice.master_fn='M1'
        and invoice.company_fn=company.company_fn
        and invoice.doc_no like 'DEMO-AP-INV-%'
        and invoice.status='unpaid' and invoice.total_amount>0
      group by company.company_fn having count(invoice.id)<>1
    `)).rows;
    expect(unusableApCases).toHaveLength(0);
    const unusableSalesApprovalStock = (await client.query(`
      select orders.doc_no
      from sales_order orders
      join sales_order_line line on line.master_fn=orders.master_fn
        and line.company_fn=orders.company_fn and line.order_id=orders.id
      join warehouse on warehouse.master_fn=orders.master_fn
        and warehouse.company_fn=orders.company_fn
        and warehouse.code=case
          when orders.company_fn='C-SG' and exists (
            select 1 from warehouse preferred
            where preferred.master_fn=orders.master_fn
              and preferred.company_fn=orders.company_fn and preferred.code='WH-SALES'
          ) then 'WH-SALES'
          when orders.company_fn='C-SG' then 'DEMO-SG-MAIN'
          else 'DEMO-MY-MAIN' end
      left join stock_level stock on stock.master_fn=orders.master_fn
        and stock.company_fn=orders.company_fn and stock.product_id=line.product_id
        and stock.warehouse_id=warehouse.id
      where orders.master_fn='M1' and orders.doc_no like 'DEMO-SO-APP-%'
        and coalesce(stock.qty,0)<line.qty
    `)).rows;
    expect(unusableSalesApprovalStock).toHaveLength(0);
    const missingPostingAccounts = (await client.query(`
      select company.company_fn, required.code
      from (values ('C-SG'),('C-MY')) company(company_fn)
      cross join (values
        ('1000'),('1100'),('1200'),('1400'),('2100'),('2200'),('2300'),('4000'),('5800')
      ) required(code)
      left join account on account.master_fn='M1'
        and account.company_fn=company.company_fn and account.code=required.code
      where account.id is null
    `)).rows;
    expect(missingPostingAccounts).toHaveLength(0);
    const masterCounts = (await client.query<{
      employees: number; customers: number; suppliers: number; products: number;
    }>(`
      select
        (select count(*)::int from employee) as employees,
        (select count(*)::int from customer) as customers,
        (select count(*)::int from supplier) as suppliers,
        (select count(*)::int from product) as products
    `)).rows[0];
    expect(Number(masterCounts.employees)).toBeGreaterThanOrEqual(100);
    expect(Number(masterCounts.customers)).toBeGreaterThanOrEqual(199);
    expect(Number(masterCounts.suppliers)).toBeGreaterThanOrEqual(100);
    expect(Number(masterCounts.products)).toBeGreaterThanOrEqual(500);
    const personas = (await client.query<{
      username: string; is_superadmin: boolean; roles: string[]; companies: string[];
    }>(`
      select u.username, bool_or(r.is_superadmin) as is_superadmin,
        array_agg(distinct r.name order by r.name) as roles,
        array_agg(distinct ucr.company_fn order by ucr.company_fn) as companies
      from app_user u
      join user_company_role ucr on ucr.user_id=u.user_id
      join role r on r.role_id=ucr.role_id
      where u.master_fn='M1' and u.username in (
        'admin','company-admin','manager','sales','buyer','warehouse','production',
        'finance-preparer','finance-checker','hr','service','viewer'
      )
      group by u.user_id,u.username order by u.username
    `)).rows;
    expect(personas).toHaveLength(12);
    const superadmin = personas.find((row) => row.username === 'admin');
    expect(superadmin).toMatchObject({ is_superadmin: true, companies: ['C-MY', 'C-SG'] });
    expect(superadmin?.roles).toContain('Superadmin');
    const viewer = personas.find((row) => row.username === 'viewer');
    expect(viewer?.roles).toContain('Viewer');
    expect(viewer?.roles).toContain('Employee');
    const missingEmployeeBaseRole = (await client.query(`
      select app_user.username,user_company.company_fn
      from app_user
      join user_company on user_company.user_id=app_user.user_id
      where app_user.master_fn='M1'
        and app_user.username in (
          'admin','company-admin','manager','sales','buyer','warehouse','production',
          'finance-preparer','finance-checker','hr','service','viewer'
        )
        and not exists (
          select 1 from user_company_role assignment
          join role on role.role_id=assignment.role_id
          where assignment.user_id=app_user.user_id
            and assignment.company_fn=user_company.company_fn
            and role.company_fn=user_company.company_fn
            and role.name='Employee'
        )
    `)).rows;
    expect(missingEmployeeBaseRole).toHaveLength(0);
    const legacyEmployeeAssignments = (await client.query(`
      select assignment.user_id,assignment.company_fn
      from user_company_role assignment
      join app_user on app_user.user_id=assignment.user_id
      join role on role.role_id=assignment.role_id
      where app_user.master_fn='M1'
        and role.name='Employee' and role.company_fn is null
        and app_user.username in (
          'admin','company-admin','manager','sales','buyer','warehouse','production',
          'finance-preparer','finance-checker','hr','service','viewer'
        )
    `)).rows;
    expect(legacyEmployeeAssignments).toHaveLength(0);
    const rolePermissions = (await client.query<{
      role_name: string; permission_key: string;
    }>(`
      select distinct role.name as role_name, permission.permission_key
      from role
      join role_permission permission on permission.role_id=role.role_id
        and permission.master_fn=role.master_fn and permission.allowed=true
      where role.master_fn='M1' and role.source_template_key is not null
      order by role.name,permission.permission_key
    `)).rows;
    const roleScopes = (await client.query<{
      role_name: string; resource_key: string; scope: string;
    }>(`
      select distinct role.name as role_name, scope.resource_key, scope.scope
      from role
      join role_resource_scope scope on scope.role_id=role.role_id
        and scope.master_fn=role.master_fn
      where role.master_fn='M1' and role.source_template_key is not null
      order by role.name,scope.resource_key
    `)).rows;
    for (const template of ROLE_TEMPLATES.filter((row) => !row.isSuperadmin)) {
      expect(
        rolePermissions.filter((row) => row.role_name === template.name)
          .map((row) => row.permission_key),
        `${template.name} Demo permissions must match the authoritative template`,
      ).toEqual([...new Set(template.permissions)].sort());
      expect(
        roleScopes.filter((row) => row.role_name === template.name)
          .map((row) => [row.resource_key, row.scope]),
        `${template.name} Demo scopes must match the authoritative template`,
      ).toEqual(Object.entries(template.scopes).sort(([left], [right]) => left.localeCompare(right)));
    }
    const identityMismatches = (await client.query(`
      select employee.employee_no
      from employee join app_user on app_user.user_id=employee.user_id
      where employee.employee_no like 'DEMO-%'
        and split_part(app_user.full_name,' · ',1)<>employee.full_name
    `)).rows;
    expect(identityMismatches).toHaveLength(0);
    const viewerIdentity = (await client.query<{
      employee_no: string; full_name: string; manager_email: string | null;
    }>(`
      select employee.employee_no,employee.full_name,manager_user.email as manager_email
      from app_user
      join employee on employee.user_id=app_user.user_id and employee.company_fn='C-SG'
      left join employee manager on manager.id=employee.manager_id
        and manager.company_fn=employee.company_fn
      left join app_user manager_user on manager_user.user_id=manager.user_id
      where app_user.email='viewer@acme.co'
    `)).rows;
    expect(viewerIdentity).toEqual([{
      employee_no: 'DEMO-SG-E012', full_name: 'Jordan Lee', manager_email: 'manager@acme.co',
    }]);
    const missingLeaveOpenings = (await client.query(`
      select employee.employee_no
      from employee
      left join leave_balance_entry entry
        on entry.master_fn=employee.master_fn and entry.company_fn=employee.company_fn
        and entry.employee_id=employee.id and entry.source_type='demo_showcase_opening'
      where employee.employee_no like 'DEMO-%'
      group by employee.id,employee.employee_no
      having coalesce(sum(entry.balance_delta),0)<>employee.annual_leave_days
    `)).rows;
    expect(missingLeaveOpenings).toHaveLength(0);
    const myLeaveTypes = (await client.query(`
      select code from leave_type where master_fn='M1' and company_fn='C-MY'
        and code in ('ANNUAL','MEDICAL','UNPAID')
    `)).rows;
    expect(myLeaveTypes).toHaveLength(3);
    const [chen] = await db.select({ id: schema.employee.id }).from(schema.employee)
      .where(sql`${schema.employee.masterFn}='M1' and ${schema.employee.companyFn}='C-SG' and ${schema.employee.employeeNo}='DEMO-SG-E001'`)
      .limit(1);
    const chenLeave = await projectEmployeeAnnualLeaveWithin(
      db, { masterFn: 'M1', companyFn: 'C-SG' }, chen.id,
    );
    expect(chenLeave).toMatchObject({
      entitlement: '14.00', balance: '14.00', reserved: '1.00', available: '13.00', entryCount: 2,
    });
    const payrollMismatches = (await client.query(`
      select run.id from payroll_run run
      join (
        select run_id,sum(gross_pay) gross,sum(net_pay) net,count(*) line_count
        from payroll_run_line group by run_id
      ) totals on totals.run_id=run.id
      where run.doc_no like 'DEMO-PAY-%'
        and (run.total_gross_pay<>totals.gross or run.total_net_pay<>totals.net or totals.line_count<>47)
    `)).rows;
    expect(payrollMismatches).toHaveLength(0);
    const statutoryMismatches = (await client.query(`
      select run.company_fn,line.income_tax_deduction,line.employer_additional_contribution
      from payroll_run_line line join payroll_run run on run.id=line.run_id
      where run.doc_no like 'DEMO-PAY-%'
        and ((run.company_fn='C-SG' and (line.income_tax_deduction<>0 or line.employer_additional_contribution<=0))
          or (run.company_fn='C-MY' and (line.income_tax_deduction<=0 or line.employer_additional_contribution<=0)))
    `)).rows;
    expect(statutoryMismatches).toHaveLength(0);
    const unmanagedStaff = (await client.query(`
      select employee_no from employee
      where employee_no like 'DEMO-%' and manager_id is null
        and employee_no not in ('DEMO-SG-E002','DEMO-MY-E001')
    `)).rows;
    expect(unmanagedStaff).toHaveLength(0);
    await client.close();
  }, 30_000);
});
