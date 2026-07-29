import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sqlPath = resolve(root, 'web/public/db/erp-system-showcase-v1.sql');
const manifestPath = resolve(root, 'web/public/db/erp-system-showcase-v1.json');
const check = process.argv.includes('--check');

const demoPasswordHash = 'pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48';
const roleSpecs = [
  ['Company Admin', 'company_admin'], ['Manager', 'manager'], ['Sales', 'sales'],
  ['Buyer', 'buyer'], ['Warehouse', 'warehouse'], ['Production', 'production'],
  ['Finance Preparer', 'finance_preparer'], ['Finance Checker', 'finance_checker'],
  ['HR', 'hr'], ['Service', 'service'], ['Viewer', 'viewer'],
];
const personaSpecs = [
  ['admin', 'admin@acme.co', 'Avery Tan · Superadmin', 'Superadmin', 'zh'],
  ['company-admin', 'company-admin@acme.co', 'Chen Wei · Company Admin', 'Company Admin', 'en'],
  ['manager', 'manager@acme.co', 'Mei Lin · Manager', 'Manager', 'zh'],
  ['sales', 'sales@acme.co', 'Daniel Lim · Sales', 'Sales', 'en'],
  ['buyer', 'buyer@acme.co', 'Nur Aisyah · Buyer', 'Buyer', 'ms'],
  ['warehouse', 'warehouse@acme.co', 'Ravi Kumar · Warehouse', 'Warehouse', 'en'],
  ['production', 'production@acme.co', 'Kenji Sato · Production', 'Production', 'ja'],
  ['finance-preparer', 'finance-preparer@acme.co', 'Siti Aminah · Finance Preparer', 'Finance Preparer', 'ms'],
  ['finance-checker', 'finance-checker@acme.co', 'Grace Lee · Finance Checker', 'Finance Checker', 'en'],
  ['hr', 'hr@acme.co', 'Linh Nguyen · HR', 'HR', 'vi'],
  ['service', 'service@acme.co', 'Marcus Ong · Service', 'Service', 'en'],
  ['viewer', 'viewer@acme.co', 'Jordan Lee · Viewer', 'Viewer', 'en'],
];
const personaEmployeeSpecs = [
  ['C-SG','DEMO-SG-E001','Chen Wei','company-admin@acme.co','Administration','Company Administrator'],
  ['C-SG','DEMO-SG-E002','Mei Lin','manager@acme.co','Operations','Operations Manager'],
  ['C-SG','DEMO-SG-E003','Daniel Lim','sales@acme.co','Sales','Account Executive'],
  ['C-SG','DEMO-SG-E004','Nur Aisyah','buyer@acme.co','Purchasing','Buyer'],
  ['C-SG','DEMO-SG-E005','Ravi Kumar','warehouse@acme.co','Warehouse','Warehouse Lead'],
  ['C-SG','DEMO-SG-E006','Kenji Sato','production@acme.co','Production','Production Planner'],
  ['C-SG','DEMO-SG-E007','Siti Aminah','finance-preparer@acme.co','Finance','Finance Executive'],
  ['C-SG','DEMO-SG-E008','Grace Lee','finance-checker@acme.co','Finance','Finance Controller'],
  ['C-SG','DEMO-SG-E009','Linh Nguyen','hr@acme.co','HR','HR Executive'],
  ['C-SG','DEMO-SG-E010','Marcus Ong','service@acme.co','Service','Service Manager'],
  ['C-SG','DEMO-SG-E011','Avery Tan','admin@acme.co','Administration','Group Systems Administrator'],
  ['C-SG','DEMO-SG-E012','Jordan Lee','viewer@acme.co','Management','Business Observer'],
  ['C-MY','DEMO-MY-E001','Siti Aminah','finance-preparer@acme.co','Finance','Finance Executive'],
  ['C-MY','DEMO-MY-E002','Grace Lee','finance-checker@acme.co','Finance','Finance Controller'],
  ['C-MY','DEMO-MY-E003','Linh Nguyen','hr@acme.co','HR','HR Executive'],
];
const rolePermissions = {
  Employee: ['employee.self.read','employee.leave.write','employee.receipts.write','employee.claims.write','employee.payout.manage'],
  'Company Admin': ['dashboard.read','admin.users.invite','admin.users.read','admin.users.manage','admin.roles.read','admin.roles.write','admin.modules.manage','admin.audit.read','settings.read','settings.manage','session.switch_company','hr.read','hr.write'],
  Manager: ['dashboard.read','employee.self.read','employee.team.read','employee.leave.write','employee.receipts.write','employee.claims.write','expenses.approve.manager','sales.read','crm.read','inventory.read','project.read','service.read','sales.approve','project.approve'],
  Sales: ['dashboard.read','sales.read','sales.write','sales.create','sales.edit','sales.export','crm.read','crm.write','crm.create','crm.edit','crm.export'],
  Buyer: ['dashboard.read','purchasing.read','purchasing.write','purchasing.create','purchasing.edit','purchasing.export','inventory.read'],
  Warehouse: ['dashboard.read','inventory.read','inventory.write','inventory.adjust','inventory.transfer','inventory.track','inventory.create','inventory.edit','inventory.post','warehouse.read','warehouse.create','warehouse.edit','warehouse.post'],
  Production: ['dashboard.read','manufacturing.read','manufacturing.write','manufacturing.create','manufacturing.edit','manufacturing.post','inventory.read','warehouse.read','quality.read','quality.write','quality.create','quality.edit','quality.post'],
  'Finance Preparer': ['dashboard.read','finance.read','finance.write','finance.create','finance.edit','finance.post','finance.export','finance.report.export','expenses.finance.verify','expenses.payment.prepare','expenses.payment.export'],
  'Finance Checker': ['dashboard.read','finance.read','finance.approve','finance.pay','finance.export','expenses.approve.finance','expenses.payment.release','expenses.payment.result.import','expenses.tax_evidence.access','finance.budget.approve'],
  HR: ['dashboard.read','hr.read','hr.write','hr.create','hr.edit','hr.approve','hr.export','payroll.read','payroll.write','payroll.create','payroll.edit','payroll.post','payroll.export','admin.users.read','admin.roles.read'],
  Service: ['dashboard.read','service.read','service.write','service.create','service.edit','service.post','crm.read'],
  Viewer: ['dashboard.read','sales.read','purchasing.read','crm.read','inventory.read','manufacturing.read','quality.read','finance.read','hr.read','project.read','service.read','asset.read','reporting.read','integration.read'],
};
const roleScopes = {
  Employee: [['employee/*','self']],
  'Company Admin': [['admin/*','company'],['hr/*','company']], Manager: [['*','team']],
  Sales: [['sales/*','self'],['crm/*','self']], Buyer: [['purchasing/*','company'],['inventory/*','company']],
  Warehouse: [['inventory/*','company'],['warehouse/*','company']], Production: [['manufacturing/*','company'],['inventory/*','company'],['warehouse/*','company'],['quality/*','company']],
  'Finance Preparer': [['finance/*','company'],['expenses/*','company']], 'Finance Checker': [['finance/*','company'],['expenses/*','company']],
  HR: [['hr/*','company'],['payroll/*','company']], Service: [['service/*','self'],['crm/*','self']], Viewer: [['*','company']],
};
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const values = (rows) => rows.map((row) => `(${row.map(q).join(',')})`).join(',\n  ');
const rolePermissionRows = Object.entries(rolePermissions).flatMap(([name, permissions]) =>
  permissions.map((permission) => [name, permission]));
const roleScopeRows = Object.entries(roleScopes).flatMap(([name, scopes]) =>
  scopes.map(([resource, scope]) => [name, resource, scope]));
const personaSql = `
INSERT INTO role (master_fn, company_fn, name, is_superadmin, source_template_key)
SELECT 'M1', company_fn, 'Superadmin', true, null
FROM (VALUES ('C-SG'),('C-MY')) company(company_fn)
ON CONFLICT (master_fn, company_fn, name)
DO UPDATE SET is_superadmin=true, source_template_key=null;

INSERT INTO role (master_fn, company_fn, name, is_superadmin, source_template_key)
SELECT 'M1', company_fn, name, false, template_key
FROM (VALUES ('C-SG'),('C-MY')) company(company_fn)
CROSS JOIN (VALUES ${values(roleSpecs)}) template(name,template_key)
ON CONFLICT (master_fn, company_fn, name) DO NOTHING;

-- Employee is a system-managed company base role, not a copyable job template.
-- Every login linked to an employee receives it in addition to the job role.
INSERT INTO role (master_fn, company_fn, name, is_superadmin, source_template_key)
SELECT 'M1', company_fn, 'Employee', false, null
FROM (VALUES ('C-SG'),('C-MY')) company(company_fn)
ON CONFLICT (master_fn, company_fn, name) DO NOTHING;

INSERT INTO app_user (master_fn, username, email, full_name, password_hash, language)
VALUES ${personaSpecs.map(([username,email,name,,language]) =>
    `('M1',${q(username)},${q(email)},${q(name)},${q(demoPasswordHash)},${q(language)})`).join(',\n  ')}
ON CONFLICT (master_fn, username) DO UPDATE SET
  email=excluded.email,
  full_name=excluded.full_name,
  language=excluded.language,
  is_active=true;

INSERT INTO role_permission (master_fn, role_id, permission_key, allowed)
SELECT 'M1', role.role_id, permission.permission_key, true
FROM role
JOIN (VALUES ${values(rolePermissionRows)}) permission(role_name,permission_key)
  ON permission.role_name=role.name
WHERE role.master_fn='M1' AND role.company_fn IN ('C-SG','C-MY')
ON CONFLICT (role_id, permission_key) DO NOTHING;

DELETE FROM role_permission permission
USING role
WHERE permission.role_id=role.role_id
  AND permission.master_fn=role.master_fn
  AND role.master_fn='M1'
  AND role.name='Company Admin'
  AND permission.permission_key='company.switch';

INSERT INTO role_resource_scope (master_fn, company_fn, role_id, resource_key, scope)
SELECT 'M1', role.company_fn, role.role_id, scoped.resource_key, scoped.scope
FROM role
JOIN (VALUES ${values(roleScopeRows)}) scoped(role_name,resource_key,scope)
  ON scoped.role_name=role.name
WHERE role.master_fn='M1' AND role.company_fn IN ('C-SG','C-MY')
ON CONFLICT (role_id, resource_key) DO NOTHING;

INSERT INTO user_company (user_id, company_fn, role_id)
SELECT app_user.user_id, assignment.company_fn, role.role_id
FROM (VALUES ${values([
    ...personaSpecs.map(([username,,,roleName]) => [username,'C-SG',roleName]),
    ['admin','C-MY','Superadmin'],
    ['finance-preparer','C-MY','Finance Preparer'], ['finance-checker','C-MY','Finance Checker'], ['hr','C-MY','HR'],
  ])}) assignment(username,company_fn,role_name)
JOIN app_user ON app_user.master_fn='M1' AND app_user.username=assignment.username
JOIN role ON role.master_fn='M1' AND role.company_fn=assignment.company_fn AND role.name=assignment.role_name
ON CONFLICT (user_id, company_fn) DO NOTHING;

INSERT INTO user_company_role (user_id, company_fn, role_id)
SELECT membership.user_id, membership.company_fn, membership.role_id
FROM user_company membership
JOIN app_user ON app_user.user_id=membership.user_id
WHERE app_user.master_fn='M1' AND app_user.username IN (${personaSpecs.map(([username]) => q(username)).join(',')})
ON CONFLICT (user_id, company_fn, role_id) DO NOTHING;

INSERT INTO user_company_role (user_id, company_fn, role_id, managed_by_system)
SELECT membership.user_id, membership.company_fn, employee_role.role_id, true
FROM user_company membership
JOIN app_user ON app_user.user_id=membership.user_id
JOIN role employee_role ON employee_role.master_fn=app_user.master_fn
  AND employee_role.company_fn=membership.company_fn
  AND employee_role.name='Employee'
WHERE app_user.master_fn='M1'
  AND app_user.username IN (${personaSpecs.map(([username]) => q(username)).join(',')})
ON CONFLICT (user_id, company_fn, role_id)
DO UPDATE SET managed_by_system=true;

-- Replace the pre-company legacy Employee compatibility assignment once the
-- company-managed base role exists; otherwise an upgraded Viewer displays the
-- same logical role twice and carries two sources of authority.
DELETE FROM user_company_role assignment
USING app_user, role legacy_role
WHERE assignment.user_id=app_user.user_id
  AND assignment.role_id=legacy_role.role_id
  AND app_user.master_fn='M1'
  AND legacy_role.master_fn=app_user.master_fn
  AND legacy_role.company_fn IS NULL
  AND legacy_role.name='Employee'
  AND app_user.username IN (${personaSpecs.map(([username]) => q(username)).join(',')});
`;

const sql = `-- Deterministic enterprise showcase pack. Generated; do not hand-edit.
-- Business date: 2026-07-27. Demo environments only.
BEGIN;

${personaSql}

INSERT INTO warehouse (master_fn, company_fn, code, name)
VALUES ('M1','C-SG','DEMO-SG-MAIN','Singapore Demo Main'),
       ('M1','C-MY','DEMO-MY-MAIN','Malaysia Demo Main')
ON CONFLICT (master_fn, company_fn, code) DO NOTHING;

INSERT INTO account (master_fn, company_fn, code, name, type)
SELECT 'M1', c.company_fn, a.code, a.name, a.type
FROM (VALUES ('C-SG'),('C-MY')) c(company_fn)
CROSS JOIN (VALUES
  ('1000','Cash & Bank','asset'),
  ('1100','Accounts Receivable','asset'),
  ('1200','Input Tax','asset'),
  ('1400','Inventory','asset'),
  ('2100','Accounts Payable','liability'),
  ('2200','Output Tax','liability'),
  ('2300','Landed Cost Accrual','liability'),
  ('4000','Revenue','income'),
  ('5800','Inventory Variance','expense'),
  ('9900','Demo opening clearing','equity'),
  ('9990','Demo showcase activity','expense')
) a(code,name,type)
ON CONFLICT (master_fn, company_fn, code) DO NOTHING;

INSERT INTO employee (
  master_fn, company_fn, employee_no, full_name, email, department, job_title,
  employment_type, start_date, annual_leave_days, base_salary
)
SELECT 'M1', c.company_fn,
  'DEMO-' || c.prefix || '-E' || lpad(g::text,3,'0'),
  c.country || ' Showcase Employee ' || lpad(g::text,3,'0'),
  lower(c.prefix) || '.showcase.' || lpad(g::text,3,'0') || '@example.test',
  (ARRAY['Sales','Purchasing','Warehouse','Production','Finance','HR','Service'])[((g-1)%7)+1],
  (ARRAY['Executive','Specialist','Coordinator','Analyst'])[((g-1)%4)+1],
  'Full-time', DATE '2026-01-01' - ((g%730) * INTERVAL '1 day'), 14,
  (3200 + (g%12)*250)::numeric(18,2)
FROM (VALUES ('C-SG','SG','Singapore'),('C-MY','MY','Malaysia')) c(company_fn,prefix,country)
CROSS JOIN generate_series(1,47) g
ON CONFLICT (master_fn, company_fn, employee_no) DO NOTHING;

UPDATE employee
SET full_name=persona.full_name,
    email=persona.email,
    department=persona.department,
    job_title=persona.job_title
FROM (VALUES ${values(personaEmployeeSpecs)})
  persona(company_fn,employee_no,full_name,email,department,job_title)
WHERE employee.master_fn='M1'
  AND employee.company_fn=persona.company_fn
  AND employee.employee_no=persona.employee_no;

-- The compact seed includes a legacy employee linked to the Viewer account.
-- Release any same-company legacy link before assigning each deterministic
-- showcase identity to its canonical employee number. This keeps one user to
-- one employee per company and makes direct-manager workflow routing stable.
UPDATE employee SET user_id=null
FROM app_user,
  (VALUES ${values(personaEmployeeSpecs.map(([companyFn,employeeNo,,email]) => [
    companyFn, employeeNo, email,
  ]))}) persona(company_fn,employee_no,email)
WHERE employee.master_fn='M1'
  AND employee.company_fn=persona.company_fn
  AND employee.employee_no<>persona.employee_no
  AND app_user.master_fn=employee.master_fn
  AND app_user.email=persona.email
  AND employee.user_id=app_user.user_id;

UPDATE employee SET user_id=app_user.user_id
FROM app_user
WHERE employee.master_fn='M1' AND app_user.master_fn='M1'
  AND (employee.company_fn, employee.employee_no, app_user.username) IN (
    ('C-SG','DEMO-SG-E001','company-admin'), ('C-SG','DEMO-SG-E002','manager'),
    ('C-SG','DEMO-SG-E003','sales'), ('C-SG','DEMO-SG-E004','buyer'),
    ('C-SG','DEMO-SG-E005','warehouse'), ('C-SG','DEMO-SG-E006','production'),
    ('C-SG','DEMO-SG-E007','finance-preparer'), ('C-SG','DEMO-SG-E008','finance-checker'),
    ('C-SG','DEMO-SG-E009','hr'), ('C-SG','DEMO-SG-E010','service'),
    ('C-SG','DEMO-SG-E011','admin'), ('C-SG','DEMO-SG-E012','viewer'),
    ('C-MY','DEMO-MY-E001','finance-preparer'), ('C-MY','DEMO-MY-E002','finance-checker'),
    ('C-MY','DEMO-MY-E003','hr')
  );

UPDATE employee staff
SET manager_id=manager.id
FROM employee manager
WHERE staff.master_fn='M1' AND manager.master_fn='M1'
  AND staff.company_fn=manager.company_fn
  AND staff.employee_no LIKE 'DEMO-%'
  AND manager.employee_no=CASE staff.company_fn
    WHEN 'C-SG' THEN 'DEMO-SG-E002'
    ELSE 'DEMO-MY-E001'
  END
  AND staff.id<>manager.id
  AND staff.manager_id IS NULL;

INSERT INTO leave_request (
  master_fn, company_fn, employee_id, leave_type, start_date, end_date, days,
  reason, status, rejection_reason, decided_at
)
SELECT 'M1', c.company_fn, employee.id,
  schedule.leave_type,schedule.start_date,schedule.end_date,schedule.days,
  'Controlled demo leave case ' || c.company_fn || '-' || schedule.case_no,
  schedule.status,
  CASE WHEN schedule.status='rejected' THEN 'Capacity limit reached for this controlled demo case' ELSE null END,
  CASE WHEN schedule.status IN ('approved','rejected','cancelled')
    THEN TIMESTAMPTZ '2026-06-27 10:00:00+08' + (schedule.case_no * INTERVAL '2 hour') ELSE null END
FROM (VALUES ('C-SG','SG'),('C-MY','MY')) c(company_fn,prefix)
CROSS JOIN (VALUES
  (1,'Annual', DATE '2026-07-02',DATE '2026-07-02',1,'pending'),
  (2,'Medical',DATE '2026-07-06',DATE '2026-07-07',2,'approved'),
  (3,'Unpaid', DATE '2026-07-09',DATE '2026-07-09',1,'rejected'),
  (4,'Annual', DATE '2026-07-13',DATE '2026-07-14',2,'pending'),
  (5,'Medical',DATE '2026-07-14',DATE '2026-07-14',1,'approved'),
  (6,'Unpaid', DATE '2026-07-20',DATE '2026-07-20',1,'rejected'),
  (7,'Annual', DATE '2026-07-23',DATE '2026-07-24',2,'approved'),
  (8,'Medical',DATE '2026-07-27',DATE '2026-07-27',1,'approved'),
  (9,'Annual', DATE '2026-07-27',DATE '2026-07-28',2,'pending'),
  (10,'Unpaid',DATE '2026-07-30',DATE '2026-07-30',1,'cancelled'),
  (11,'Annual',DATE '2026-08-03',DATE '2026-08-03',1,'approved'),
  (12,'Medical',DATE '2026-08-05',DATE '2026-08-05',1,'rejected')
) schedule(case_no,leave_type,start_date,end_date,days,status)
CROSS JOIN LATERAL (
  SELECT id FROM employee
  WHERE master_fn='M1' AND company_fn=c.company_fn AND employee_no LIKE 'DEMO-%'
  ORDER BY employee_no OFFSET (schedule.case_no-1) LIMIT 1
) employee
WHERE NOT EXISTS (
  SELECT 1 FROM leave_request request
  WHERE request.master_fn='M1' AND request.company_fn=c.company_fn
    AND request.reason='Controlled demo leave case ' || c.company_fn || '-' || schedule.case_no
);

-- Upgrade controlled showcase rows from earlier packs in place. These rows are
-- owned by the Demo generator (never customer data), so fresh and upgraded
-- IndexedDB/PostgreSQL installations converge on the same dated calendar.
UPDATE leave_request request
SET leave_type=schedule.leave_type,
    start_date=schedule.start_date,
    end_date=schedule.end_date,
    days=schedule.days,
    status=schedule.status,
    rejection_reason=CASE WHEN schedule.status='rejected'
      THEN 'Capacity limit reached for this controlled demo case' ELSE null END,
    decided_at=CASE WHEN schedule.status IN ('approved','rejected','cancelled')
      THEN TIMESTAMPTZ '2026-06-27 10:00:00+08' + (schedule.case_no * INTERVAL '2 hour') ELSE null END
FROM (VALUES
  ('C-SG',1,'Annual', DATE '2026-07-02',DATE '2026-07-02',1,'pending'),
  ('C-SG',2,'Medical',DATE '2026-07-06',DATE '2026-07-07',2,'approved'),
  ('C-SG',3,'Unpaid', DATE '2026-07-09',DATE '2026-07-09',1,'rejected'),
  ('C-SG',4,'Annual', DATE '2026-07-13',DATE '2026-07-14',2,'pending'),
  ('C-SG',5,'Medical',DATE '2026-07-14',DATE '2026-07-14',1,'approved'),
  ('C-SG',6,'Unpaid', DATE '2026-07-20',DATE '2026-07-20',1,'rejected'),
  ('C-MY',1,'Annual', DATE '2026-07-02',DATE '2026-07-02',1,'pending'),
  ('C-MY',2,'Medical',DATE '2026-07-06',DATE '2026-07-07',2,'approved'),
  ('C-MY',3,'Unpaid', DATE '2026-07-09',DATE '2026-07-09',1,'rejected'),
  ('C-MY',4,'Annual', DATE '2026-07-13',DATE '2026-07-14',2,'pending'),
  ('C-MY',5,'Medical',DATE '2026-07-14',DATE '2026-07-14',1,'approved'),
  ('C-MY',6,'Unpaid', DATE '2026-07-20',DATE '2026-07-20',1,'rejected')
) schedule(company_fn,case_no,leave_type,start_date,end_date,days,status)
WHERE request.master_fn='M1'
  AND request.company_fn=schedule.company_fn
  AND request.reason='Controlled demo leave case ' || schedule.company_fn || '-' || schedule.case_no;

INSERT INTO working_calendar (master_fn,company_fn,code,name,time_zone,is_default,is_active)
SELECT 'M1',company.company_fn,company.code,company.name,company.time_zone,true,true
FROM (VALUES
  ('C-SG','SG-STANDARD','Singapore standard work week','Asia/Singapore'),
  ('C-MY','MY-STANDARD','Malaysia standard work week','Asia/Kuala_Lumpur')
) company(company_fn,code,name,time_zone)
WHERE NOT EXISTS (
  SELECT 1 FROM working_calendar existing
  WHERE existing.master_fn='M1' AND existing.company_fn=company.company_fn
    AND existing.is_default=true
)
ON CONFLICT (master_fn,company_fn,code) DO NOTHING;

INSERT INTO working_calendar_version (
  master_fn,company_fn,calendar_id,version_no,effective_from,weekdays,status,
  confirmed_by_user_id,confirmed_at
)
SELECT 'M1',calendar.company_fn,calendar.id,1,DATE '2026-01-01','[1,2,3,4,5]'::jsonb,
  'confirmed',app_user.user_id,TIMESTAMPTZ '2025-12-01 00:00:00+00'
FROM working_calendar calendar
JOIN app_user ON app_user.master_fn='M1' AND app_user.username='admin'
WHERE calendar.master_fn='M1' AND calendar.company_fn IN ('C-SG','C-MY')
  AND calendar.is_default=true
ON CONFLICT (master_fn,company_fn,calendar_id,version_no) DO NOTHING;

INSERT INTO leave_type (master_fn,company_fn,code,name,paid,is_active)
VALUES ('M1','C-SG','ANNUAL','Annual leave',true,true),
       ('M1','C-SG','MEDICAL','Medical leave',true,true),
       ('M1','C-SG','UNPAID','Unpaid leave',false,true),
       ('M1','C-MY','ANNUAL','Annual leave',true,true),
       ('M1','C-MY','MEDICAL','Medical leave',true,true),
       ('M1','C-MY','UNPAID','Unpaid leave',false,true)
ON CONFLICT (master_fn,company_fn,code) DO UPDATE SET
  name=excluded.name,paid=excluded.paid,is_active=excluded.is_active;

INSERT INTO leave_policy_version (
  master_fn,company_fn,leave_type_id,calendar_id,version_no,effective_from,status,
  unit_mode,annual_entitlement_days,accrual_method,carry_forward_days,
  carry_expiry_months,evidence_after_days,staffing_action,minimum_staff,
  encashment_allowed,encashment_max_days,eligible_employment_types,
  confirmed_by_user_id,confirmed_at
)
SELECT 'M1',leave_type.company_fn,leave_type.id,calendar.id,1,DATE '2026-01-01','confirmed',
  'full_and_half_day',
  CASE leave_type.code WHEN 'UNPAID' THEN 0 ELSE 14 END,
  CASE leave_type.code WHEN 'ANNUAL' THEN 'monthly' WHEN 'MEDICAL' THEN 'upfront' ELSE 'none' END,
  CASE leave_type.code WHEN 'ANNUAL' THEN 5 ELSE 0 END,
  CASE leave_type.code WHEN 'ANNUAL' THEN 3 ELSE null END,
  CASE leave_type.code WHEN 'MEDICAL' THEN 2 ELSE null END,
  CASE leave_type.code WHEN 'UNPAID' THEN 'extra_approval' ELSE 'warn' END,
  CASE leave_type.code WHEN 'ANNUAL' THEN 2 ELSE 0 END,
  leave_type.code='ANNUAL',CASE leave_type.code WHEN 'ANNUAL' THEN 3 ELSE 0 END,
  '["Full-time","Part-time","Contract","Intern"]'::jsonb,
  app_user.user_id,TIMESTAMPTZ '2025-12-01 00:00:00+00'
FROM leave_type
JOIN working_calendar calendar ON calendar.master_fn=leave_type.master_fn
  AND calendar.company_fn=leave_type.company_fn AND calendar.is_default=true
JOIN app_user ON app_user.master_fn='M1' AND app_user.username='admin'
WHERE leave_type.master_fn='M1' AND leave_type.company_fn IN ('C-SG','C-MY')
  AND leave_type.code IN ('ANNUAL','MEDICAL','UNPAID')
ON CONFLICT (master_fn,company_fn,leave_type_id,version_no) DO NOTHING;

INSERT INTO leave_balance_entry (
  master_fn,company_fn,employee_id,leave_type_id,policy_version_id,
  entry_type,entry_key,balance_delta,reserved_delta,effective_date,
  source_type,source_id,note,created_by_user_id
)
SELECT employee.master_fn,employee.company_fn,employee.id,leave_type.id,policy.id,
  'grant','demo-showcase:2026:annual:' || employee.company_fn || ':' || employee.employee_no,
  employee.annual_leave_days,0,DATE '2026-01-01','demo_showcase_opening',
  employee.employee_no,'Deterministic showcase annual leave opening',app_user.user_id
FROM employee
JOIN leave_type ON leave_type.master_fn=employee.master_fn
  AND leave_type.company_fn=employee.company_fn AND leave_type.code='ANNUAL'
JOIN leave_policy_version policy ON policy.master_fn=employee.master_fn
  AND policy.company_fn=employee.company_fn AND policy.leave_type_id=leave_type.id
  AND policy.status='confirmed' AND policy.effective_from<=DATE '2026-01-01'
JOIN app_user ON app_user.master_fn='M1' AND app_user.username='admin'
WHERE employee.master_fn='M1' AND employee.employee_no LIKE 'DEMO-%'
ON CONFLICT (master_fn,company_fn,entry_key) DO NOTHING;

INSERT INTO leave_balance_entry (
  master_fn,company_fn,employee_id,leave_type_id,policy_version_id,
  entry_type,entry_key,balance_delta,reserved_delta,effective_date,
  source_type,source_id,note,created_by_user_id
)
SELECT request.master_fn,request.company_fn,request.employee_id,leave_type.id,policy.id,
  'reserve','demo-showcase:leave-reserve:' || request.id,0,request.days,request.start_date,
  'demo_showcase_leave_request',request.id::text,'Pending showcase leave reservation',app_user.user_id
FROM leave_request request
JOIN leave_type ON leave_type.master_fn=request.master_fn
  AND leave_type.company_fn=request.company_fn AND leave_type.code='ANNUAL'
JOIN leave_policy_version policy ON policy.master_fn=request.master_fn
  AND policy.company_fn=request.company_fn AND policy.leave_type_id=leave_type.id
  AND policy.status='confirmed' AND policy.effective_from<=request.start_date
JOIN app_user ON app_user.master_fn='M1' AND app_user.username='admin'
WHERE request.master_fn='M1' AND request.status='pending' AND request.leave_type='Annual'
  AND request.reason LIKE 'Controlled demo leave case %'
ON CONFLICT (master_fn,company_fn,entry_key) DO NOTHING;

INSERT INTO payroll_run (
  master_fn, company_fn, doc_no, period_start, period_end, pay_date, status,
  total_gross_pay, total_net_pay, version, posted_at
)
SELECT 'M1', c.company_fn,
  'DEMO-PAY-' || c.prefix || '-' || spec.period_key,
  spec.period_start, spec.period_end, spec.pay_date, spec.status,
  0, 0, 1,
  CASE WHEN spec.status='posted' THEN spec.pay_date::timestamp + INTERVAL '18 hours' ELSE null END
FROM (VALUES ('C-SG','SG'),('C-MY','MY')) c(company_fn,prefix)
CROSS JOIN (VALUES
  ('2026-04',DATE '2026-04-01',DATE '2026-04-30',DATE '2026-04-30','cancelled'),
  ('2026-05',DATE '2026-05-01',DATE '2026-05-31',DATE '2026-05-29','posted'),
  ('2026-06',DATE '2026-06-01',DATE '2026-06-30',DATE '2026-06-30','draft')
) spec(period_key,period_start,period_end,pay_date,status)
ON CONFLICT (master_fn, company_fn, doc_no) DO NOTHING;

INSERT INTO payroll_run_line (
  master_fn, company_fn, run_id, line_no, employee_id,
  base_gross_pay, leave_earnings, leave_deductions, gross_pay,
  employee_statutory_deduction, income_tax_deduction,
  employer_statutory_contribution, employer_additional_contribution, net_pay
)
SELECT 'M1', run.company_fn, run.id,
  row_number() OVER (PARTITION BY run.id ORDER BY employee.employee_no)::int,
  employee.id, employee.base_salary, 0, 0, employee.base_salary,
  round(employee.base_salary * CASE WHEN run.company_fn='C-SG' THEN 0.20 ELSE 0.11 END,2),
  round(employee.base_salary * CASE WHEN run.company_fn='C-SG' THEN 0 ELSE 0.03 END,2),
  round(employee.base_salary * CASE WHEN run.company_fn='C-SG' THEN 0.17 ELSE 0.12 END,2),
  round(employee.base_salary * CASE WHEN run.company_fn='C-SG' THEN 0.0025 ELSE 0.0215 END,2),
  employee.base_salary
    - round(employee.base_salary * CASE WHEN run.company_fn='C-SG' THEN 0.20 ELSE 0.11 END,2)
    - round(employee.base_salary * CASE WHEN run.company_fn='C-SG' THEN 0 ELSE 0.03 END,2)
FROM payroll_run run
JOIN employee ON employee.master_fn=run.master_fn
  AND employee.company_fn=run.company_fn
  AND employee.employee_no LIKE 'DEMO-%'
WHERE run.master_fn='M1' AND run.doc_no LIKE 'DEMO-PAY-%'
ON CONFLICT (master_fn, company_fn, run_id, line_no) DO UPDATE SET
  employee_id=excluded.employee_id,
  base_gross_pay=excluded.base_gross_pay,
  leave_earnings=excluded.leave_earnings,
  leave_deductions=excluded.leave_deductions,
  gross_pay=excluded.gross_pay,
  employee_statutory_deduction=excluded.employee_statutory_deduction,
  income_tax_deduction=excluded.income_tax_deduction,
  employer_statutory_contribution=excluded.employer_statutory_contribution,
  employer_additional_contribution=excluded.employer_additional_contribution,
  net_pay=excluded.net_pay;

UPDATE payroll_run run
SET total_gross_pay=totals.gross, total_net_pay=totals.net
FROM (
  SELECT run_id, sum(gross_pay) AS gross, sum(net_pay) AS net
  FROM payroll_run_line GROUP BY run_id
) totals
WHERE run.id=totals.run_id AND run.master_fn='M1' AND run.doc_no LIKE 'DEMO-PAY-%';

INSERT INTO customer (master_fn, company_fn, code, name, industry, owner_user_id)
SELECT 'M1', c.company_fn,
  'DEMO-' || c.prefix || '-C' || lpad(g::text,3,'0'),
  c.country || ' Showcase Customer ' || lpad(g::text,3,'0'),
  (ARRAY['Manufacturing','Retail','Technology','Logistics','Healthcare'])[((g-1)%5)+1],
  (SELECT min(uc.user_id) FROM user_company uc WHERE uc.company_fn=c.company_fn)
FROM (VALUES ('C-SG','SG','Singapore'),('C-MY','MY','Malaysia')) c(company_fn,prefix,country)
CROSS JOIN generate_series(1,99) g
ON CONFLICT (master_fn, company_fn, code) DO NOTHING;

INSERT INTO supplier (master_fn, company_fn, code, name)
SELECT 'M1', c.company_fn,
  'DEMO-' || c.prefix || '-S' || lpad(g::text,3,'0'),
  c.country || ' Showcase Supplier ' || lpad(g::text,3,'0')
FROM (VALUES ('C-SG','SG','Singapore'),('C-MY','MY','Malaysia')) c(company_fn,prefix,country)
CROSS JOIN generate_series(1,49) g
ON CONFLICT (master_fn, company_fn, code) DO NOTHING;

INSERT INTO product (
  master_fn, company_fn, sku, name, uom, category, standard_cost,
  reorder_point, reorder_qty, tracking_type
)
SELECT 'M1', c.company_fn,
  'DEMO-' || c.prefix || '-P' || lpad(g::text,3,'0'),
  c.country || ' Showcase Item ' || lpad(g::text,3,'0'),
  CASE WHEN g%5=0 THEN 'box' ELSE 'unit' END,
  (ARRAY['Components','Raw Materials','Finished Goods','Consumables','Packaging'])[((g-1)%5)+1],
  (1 + (g%100)*0.75)::numeric(18,4), 10 + (g%25), 25 + (g%100),
  CASE WHEN g%20=0 THEN 'lot' WHEN g%37=0 THEN 'serial' ELSE 'none' END
FROM (VALUES ('C-SG','SG','Singapore'),('C-MY','MY','Malaysia')) c(company_fn,prefix,country)
CROSS JOIN generate_series(1,249) g
ON CONFLICT (master_fn, company_fn, sku) DO NOTHING;

-- A real pending sales-approval case per legal entity. Historical SO-2/SO-3
-- remain the explicit confirm/rollback teaching cases and must not be falsely
-- presented as approvals merely because they are drafts.
INSERT INTO sales_order (
  master_fn, company_fn, doc_no, customer_id, salesperson_user_id, status,
  order_date, currency, net_amount, tax_amount, total_amount
)
SELECT 'M1', company.company_fn, 'DEMO-SO-APP-' || company.prefix || '-0001',
  customer.id, salesperson.user_id, 'pending_approval', DATE '2026-07-27',
  company.currency, company.net_amount, company.tax_amount, company.total_amount
FROM (VALUES
  ('C-SG','SG','SGD',100.00::numeric,9.00::numeric,109.00::numeric),
  ('C-MY','MY','MYR',125.00::numeric,0.00::numeric,125.00::numeric)
) company(company_fn,prefix,currency,net_amount,tax_amount,total_amount)
JOIN customer ON customer.master_fn='M1' AND customer.company_fn=company.company_fn
  AND customer.code='DEMO-' || company.prefix || '-C001'
JOIN app_user salesperson ON salesperson.master_fn='M1' AND salesperson.username='sales'
WHERE NOT EXISTS (
  SELECT 1 FROM sales_order existing
  WHERE existing.master_fn='M1' AND existing.company_fn=company.company_fn
    AND existing.doc_no='DEMO-SO-APP-' || company.prefix || '-0001'
);

INSERT INTO sales_order_line (
  master_fn, company_fn, order_id, line_no, product_id, qty, unit_price,
  net_amount, tax_code, tax_rate, tax_amount
)
SELECT orders.master_fn, orders.company_fn, orders.id, 1, product.id, 10,
  orders.net_amount / 10, orders.net_amount,
  CASE orders.company_fn WHEN 'C-SG' THEN 'SR' ELSE 'ZR' END,
  CASE orders.company_fn WHEN 'C-SG' THEN 9.000 ELSE 0.000 END,
  orders.tax_amount
FROM sales_order orders
JOIN product ON product.master_fn=orders.master_fn AND product.company_fn=orders.company_fn
  AND product.sku=CASE orders.company_fn
    WHEN 'C-SG' THEN 'DEMO-SG-P001' ELSE 'DEMO-MY-P001' END
WHERE orders.master_fn='M1' AND orders.doc_no LIKE 'DEMO-SO-APP-%'
  AND NOT EXISTS (
    SELECT 1 FROM sales_order_line existing
    WHERE existing.master_fn=orders.master_fn AND existing.company_fn=orders.company_fn
      AND existing.order_id=orders.id AND existing.line_no=1
  );

INSERT INTO sales_order_approval (
  master_fn, company_fn, order_id, status, reason, submitted_at
)
SELECT orders.master_fn, orders.company_fn, orders.id, 'pending',
  'Controlled Demo sales approval awaiting manager decision',
  TIMESTAMPTZ '2026-07-27 09:30:00+08'
FROM sales_order orders
WHERE orders.master_fn='M1' AND orders.doc_no LIKE 'DEMO-SO-APP-%'
  AND NOT EXISTS (
    SELECT 1 FROM sales_order_approval existing
    WHERE existing.master_fn=orders.master_fn AND existing.company_fn=orders.company_fn
      AND existing.order_id=orders.id
  );

-- Give each controlled approval case enough stock in the exact warehouse used
-- by the confirmation command. This deliberately avoids presenting aggregate
-- cross-warehouse stock as if it were available for fulfilment.
WITH seeded_approval_stock AS (
  INSERT INTO stock_movement (
    master_fn, company_fn, product_id, warehouse_id, movement_group,
    qty, direction, moved_at, ref_type, ref_id
  )
  SELECT orders.master_fn, orders.company_fn, line.product_id, warehouse.id,
    'DEMO-SO-APP-STOCK-' || orders.company_fn,
    25, 'in', TIMESTAMPTZ '2026-07-27 09:00:00+08',
    'demo_sales_approval', orders.id
  FROM sales_order orders
  JOIN sales_order_line line ON line.master_fn=orders.master_fn
    AND line.company_fn=orders.company_fn AND line.order_id=orders.id
  JOIN warehouse ON warehouse.master_fn=orders.master_fn
    AND warehouse.company_fn=orders.company_fn
    AND warehouse.code=CASE
      WHEN orders.company_fn='C-SG' AND EXISTS (
        SELECT 1 FROM warehouse preferred
        WHERE preferred.master_fn=orders.master_fn
          AND preferred.company_fn=orders.company_fn AND preferred.code='WH-SALES'
      ) THEN 'WH-SALES'
      WHEN orders.company_fn='C-SG' THEN 'DEMO-SG-MAIN'
      ELSE 'DEMO-MY-MAIN' END
  WHERE orders.master_fn='M1' AND orders.doc_no LIKE 'DEMO-SO-APP-%'
    AND NOT EXISTS (
      SELECT 1 FROM stock_movement existing
      WHERE existing.master_fn=orders.master_fn
        AND existing.company_fn=orders.company_fn
        AND existing.ref_type='demo_sales_approval' AND existing.ref_id=orders.id
    )
  RETURNING master_fn,company_fn,product_id,warehouse_id,qty
)
INSERT INTO stock_level (master_fn,company_fn,product_id,warehouse_id,qty)
SELECT master_fn,company_fn,product_id,warehouse_id,qty FROM seeded_approval_stock
ON CONFLICT (master_fn,company_fn,product_id,warehouse_id)
DO UPDATE SET qty=stock_level.qty + excluded.qty, updated_at=now();

-- A complete, unpaid procure-to-pay case per legal entity. These records are
-- deliberately independent of the small canonical seed so historical Demo
-- databases receive a usable Payment Voucher path without replacing user data.
INSERT INTO purchase_order (
  master_fn, company_fn, doc_no, supplier_id, status, order_date, currency,
  net_amount, tax_amount, total_amount
)
SELECT 'M1', company.company_fn, 'DEMO-AP-PO-' || company.prefix || '-0001', supplier.id,
  'received', DATE '2026-06-20', company.currency,
  company.net_amount, company.tax_amount, company.total_amount
FROM (VALUES
  ('C-SG','SG','SGD',1000.00::numeric,90.00::numeric,1090.00::numeric),
  ('C-MY','MY','MYR',1250.00::numeric,0.00::numeric,1250.00::numeric)
) company(company_fn,prefix,currency,net_amount,tax_amount,total_amount)
JOIN supplier ON supplier.master_fn='M1' AND supplier.company_fn=company.company_fn
  AND supplier.code='DEMO-' || company.prefix || '-S001'
WHERE NOT EXISTS (
  SELECT 1 FROM purchase_order existing
  WHERE existing.master_fn='M1' AND existing.company_fn=company.company_fn
    AND existing.doc_no='DEMO-AP-PO-' || company.prefix || '-0001'
);

INSERT INTO purchase_order_line (
  master_fn, company_fn, order_id, line_no, product_id, qty, unit_cost,
  net_amount, tax_code, tax_rate, tax_amount
)
SELECT 'M1', purchase_order.company_fn, purchase_order.id, 1, product.id, 10,
  purchase_order.net_amount / 10, purchase_order.net_amount,
  CASE purchase_order.company_fn WHEN 'C-SG' THEN 'SR' ELSE 'ZR' END,
  CASE purchase_order.company_fn WHEN 'C-SG' THEN 9.000 ELSE 0.000 END,
  purchase_order.tax_amount
FROM purchase_order
JOIN product ON product.master_fn=purchase_order.master_fn
  AND product.company_fn=purchase_order.company_fn
  AND product.sku=CASE purchase_order.company_fn
    WHEN 'C-SG' THEN 'DEMO-SG-P001' ELSE 'DEMO-MY-P001' END
WHERE purchase_order.master_fn='M1' AND purchase_order.doc_no LIKE 'DEMO-AP-PO-%'
  AND NOT EXISTS (
    SELECT 1 FROM purchase_order_line existing
    WHERE existing.master_fn=purchase_order.master_fn
      AND existing.company_fn=purchase_order.company_fn
      AND existing.order_id=purchase_order.id AND existing.line_no=1
  );

INSERT INTO goods_receipt (
  master_fn, company_fn, doc_no, order_id, warehouse_id, received_date
)
SELECT 'M1', purchase_order.company_fn,
  replace(purchase_order.doc_no,'DEMO-AP-PO-','DEMO-AP-GR-'),
  purchase_order.id, warehouse.id, DATE '2026-06-21'
FROM purchase_order
JOIN warehouse ON warehouse.master_fn=purchase_order.master_fn
  AND warehouse.company_fn=purchase_order.company_fn
  AND warehouse.code=CASE purchase_order.company_fn
    WHEN 'C-SG' THEN 'DEMO-SG-MAIN' ELSE 'DEMO-MY-MAIN' END
WHERE purchase_order.master_fn='M1' AND purchase_order.doc_no LIKE 'DEMO-AP-PO-%'
  AND NOT EXISTS (
    SELECT 1 FROM goods_receipt existing
    WHERE existing.master_fn=purchase_order.master_fn
      AND existing.company_fn=purchase_order.company_fn
      AND existing.doc_no=replace(purchase_order.doc_no,'DEMO-AP-PO-','DEMO-AP-GR-')
  );

WITH received_stock AS (
  INSERT INTO stock_movement (
    master_fn, company_fn, product_id, warehouse_id, movement_group,
    qty, direction, moved_at, ref_type, ref_id
  )
  SELECT receipt.master_fn, receipt.company_fn, line.product_id, receipt.warehouse_id,
    replace(receipt.doc_no,'DEMO-AP-GR-','DEMO-AP-RECEIPT-'),
    line.qty, 'in', TIMESTAMPTZ '2026-06-21 09:00:00+08', 'goods_receipt', receipt.id
  FROM goods_receipt receipt
  JOIN purchase_order_line line ON line.master_fn=receipt.master_fn
    AND line.company_fn=receipt.company_fn AND line.order_id=receipt.order_id
  WHERE receipt.master_fn='M1' AND receipt.doc_no LIKE 'DEMO-AP-GR-%'
    AND NOT EXISTS (
      SELECT 1 FROM stock_movement existing
      WHERE existing.master_fn=receipt.master_fn
        AND existing.company_fn=receipt.company_fn
        AND existing.ref_type='goods_receipt' AND existing.ref_id=receipt.id
    )
  RETURNING master_fn,company_fn,product_id,warehouse_id,qty
)
INSERT INTO stock_level (master_fn,company_fn,product_id,warehouse_id,qty)
SELECT master_fn,company_fn,product_id,warehouse_id,qty FROM received_stock
ON CONFLICT (master_fn,company_fn,product_id,warehouse_id)
DO UPDATE SET qty=stock_level.qty + excluded.qty, updated_at=now();

INSERT INTO supplier_invoice (
  master_fn, company_fn, doc_no, order_id, supplier_id, status, invoice_date,
  currency, net_amount, tax_amount, total_amount
)
SELECT purchase_order.master_fn, purchase_order.company_fn,
  replace(purchase_order.doc_no,'DEMO-AP-PO-','DEMO-AP-INV-'),
  purchase_order.id, purchase_order.supplier_id, 'unpaid', DATE '2026-06-23',
  purchase_order.currency, purchase_order.net_amount,
  purchase_order.tax_amount, purchase_order.total_amount
FROM purchase_order
WHERE purchase_order.master_fn='M1' AND purchase_order.doc_no LIKE 'DEMO-AP-PO-%'
  AND NOT EXISTS (
    SELECT 1 FROM supplier_invoice existing
    WHERE existing.master_fn=purchase_order.master_fn
      AND existing.company_fn=purchase_order.company_fn
      AND existing.doc_no=replace(purchase_order.doc_no,'DEMO-AP-PO-','DEMO-AP-INV-')
  );

INSERT INTO gl_entry (
  master_fn, company_fn, posted_at, journal_ref, account_id, debit, credit, memo
)
SELECT invoice.master_fn, invoice.company_fn, TIMESTAMPTZ '2026-06-23 09:00:00+08',
  invoice.doc_no, account.id, leg.debit, leg.credit, leg.memo
FROM supplier_invoice invoice
CROSS JOIN LATERAL (VALUES
  ('1400',invoice.net_amount,0::numeric,'Inventory'),
  ('1200',invoice.tax_amount,0::numeric,'Input tax'),
  ('2100',0::numeric,invoice.total_amount,'AP')
) leg(account_code,debit,credit,memo)
JOIN account ON account.master_fn=invoice.master_fn
  AND account.company_fn=invoice.company_fn AND account.code=leg.account_code
WHERE invoice.master_fn='M1' AND invoice.doc_no LIKE 'DEMO-AP-INV-%'
  AND NOT EXISTS (
    SELECT 1 FROM gl_entry existing
    WHERE existing.master_fn=invoice.master_fn
      AND existing.company_fn=invoice.company_fn
      AND existing.journal_ref=invoice.doc_no
  );

INSERT INTO activity (master_fn, company_fn, customer_id, kind, body, occurred_at)
SELECT 'M1', c.company_fn, picked.id,
  (ARRAY['note','call','email','system'])[((g-1)%4)+1],
  'Deterministic showcase activity ' || g,
  TIMESTAMPTZ '2026-07-27 09:00:00+08' - ((g%180) * INTERVAL '1 hour')
FROM (VALUES ('C-SG'),('C-MY')) c(company_fn)
CROSS JOIN generate_series(1,2000) g
CROSS JOIN LATERAL (
  SELECT id FROM customer
  WHERE master_fn='M1' AND company_fn=c.company_fn AND code LIKE 'DEMO-%'
  ORDER BY code OFFSET ((g-1)%99) LIMIT 1
) picked
WHERE NOT EXISTS (
  SELECT 1 FROM activity a WHERE a.master_fn='M1' AND a.company_fn=c.company_fn
    AND a.body='Deterministic showcase activity ' || g
);

INSERT INTO stock_movement (
  master_fn, company_fn, product_id, warehouse_id, movement_group,
  qty, direction, moved_at, ref_type, ref_id
)
SELECT 'M1', c.company_fn, p.id, w.id,
  'DEMO-PACK-' || lpad(ceil(g/2.0)::int::text,4,'0'),
  1 + (g%5), CASE WHEN g%2=1 THEN 'in' ELSE 'out' END,
  TIMESTAMPTZ '2026-07-27 08:00:00+08' - ((g%720) * INTERVAL '1 minute'),
  'demo_pack', g
FROM (VALUES ('C-SG'),('C-MY')) c(company_fn)
CROSS JOIN generate_series(1,2000) g
CROSS JOIN LATERAL (
  SELECT id FROM product WHERE master_fn='M1' AND company_fn=c.company_fn AND sku LIKE 'DEMO-%'
  ORDER BY sku OFFSET ((g-1)%249) LIMIT 1
) p
CROSS JOIN LATERAL (
  SELECT id FROM warehouse WHERE master_fn='M1' AND company_fn=c.company_fn AND code LIKE 'DEMO-%'
  ORDER BY code LIMIT 1
) w
WHERE NOT EXISTS (
  SELECT 1 FROM stock_movement sm WHERE sm.master_fn='M1' AND sm.company_fn=c.company_fn
    AND sm.ref_type='demo_pack' AND sm.ref_id=g
);

INSERT INTO gl_entry (master_fn, company_fn, posted_at, journal_ref, account_id, debit, credit, memo)
SELECT 'M1', c.company_fn,
  TIMESTAMPTZ '2026-07-27 12:00:00+08' - ((g%180) * INTERVAL '1 day'),
  'DEMO-JE-' || c.company_fn || '-' || lpad(g::text,4,'0'), a.id,
  CASE WHEN a.code='9990' THEN (10+(g%90))::numeric(18,2) ELSE 0 END,
  CASE WHEN a.code='9900' THEN (10+(g%90))::numeric(18,2) ELSE 0 END,
  'Balanced deterministic showcase journal'
FROM (VALUES ('C-SG'),('C-MY')) c(company_fn)
CROSS JOIN generate_series(1,500) g
JOIN account a ON a.master_fn='M1' AND a.company_fn=c.company_fn AND a.code IN ('9900','9990')
WHERE NOT EXISTS (
  SELECT 1 FROM gl_entry ge WHERE ge.master_fn='M1' AND ge.company_fn=c.company_fn
    AND ge.journal_ref='DEMO-JE-' || c.company_fn || '-' || lpad(g::text,4,'0')
);

INSERT INTO system_state (key, value, updated_at)
VALUES ('demo_showcase_pack', '{"version":"15","businessDate":"2026-07-27","records":10436,"personas":12}'::jsonb, now())
ON CONFLICT (key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

COMMIT;
`;

const hash = createHash('sha256').update(sql).digest('hex');
const manifest = `${JSON.stringify({
  version: '15', businessDate: '2026-07-27', sha256: hash,
  personas: 12,
  generated: { employees: 94, customers: 198, suppliers: 98, products: 498 },
  records: {
    activities: 4000, stockMovements: 4002, glEntries: 2000,
    leaveRequests: 24, leaveBalanceEntries: 100, payrollRuns: 6, payrollLines: 282,
    salesOrders: 2, salesOrderLines: 2, salesOrderApprovals: 2,
    purchaseOrders: 2, purchaseOrderLines: 2, goodsReceipts: 2,
    apStockMovements: 2, supplierInvoices: 2, apGlEntries: 6, total: 10436,
  },
  companies: ['C-SG', 'C-MY'],
}, null, 2)}\n`;

if (check) {
  const [currentSql, currentManifest] = await Promise.all([
    readFile(sqlPath, 'utf8'), readFile(manifestPath, 'utf8'),
  ]);
  if (currentSql !== sql || currentManifest !== manifest) {
    throw new Error('Demo showcase pack is stale. Run npm run generate:demo-pack.');
  }
  console.log(`Demo showcase pack v15 verified (${hash}).`);
} else {
  await mkdir(dirname(sqlPath), { recursive: true });
  await Promise.all([writeFile(sqlPath, sql), writeFile(manifestPath, manifest)]);
  console.log(`Generated deterministic Demo showcase pack v15 (${hash}).`);
}
