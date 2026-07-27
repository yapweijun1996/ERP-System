-- Deterministic enterprise showcase pack. Generated; do not hand-edit.
-- Business date: 2026-07-27. Demo environments only.
BEGIN;


INSERT INTO role (master_fn, company_fn, name, is_superadmin, source_template_key)
SELECT 'M1', company_fn, name, false, template_key
FROM (VALUES ('C-SG'),('C-MY')) company(company_fn)
CROSS JOIN (VALUES ('Company Admin','company_admin'),
  ('Manager','manager'),
  ('Sales','sales'),
  ('Buyer','buyer'),
  ('Warehouse','warehouse'),
  ('Production','production'),
  ('Finance Preparer','finance_preparer'),
  ('Finance Checker','finance_checker'),
  ('HR','hr'),
  ('Service','service'),
  ('Viewer','viewer')) template(name,template_key)
ON CONFLICT (master_fn, company_fn, name) DO NOTHING;

INSERT INTO app_user (master_fn, username, email, full_name, password_hash, language)
VALUES ('M1','company-admin','company-admin@acme.co','Chen Wei · Company Admin','pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48','en'),
  ('M1','manager','manager@acme.co','Mei Lin · Manager','pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48','zh'),
  ('M1','sales','sales@acme.co','Daniel Lim · Sales','pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48','en'),
  ('M1','buyer','buyer@acme.co','Nur Aisyah · Buyer','pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48','ms'),
  ('M1','warehouse','warehouse@acme.co','Ravi Kumar · Warehouse','pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48','en'),
  ('M1','production','production@acme.co','Kenji Sato · Production','pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48','ja'),
  ('M1','finance-preparer','finance-preparer@acme.co','Siti Aminah · Finance Preparer','pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48','ms'),
  ('M1','finance-checker','finance-checker@acme.co','Grace Lee · Finance Checker','pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48','en'),
  ('M1','hr','hr@acme.co','Linh Nguyen · HR','pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48','vi'),
  ('M1','service','service@acme.co','Marcus Ong · Service','pbkdf2$100000$e154d2b848d8c3d5d3d5f494b7fd446c$a299c39883dd29e1d800946af0be615e603f907ba0f4156ebdd2b287ccd4fc48','en')
ON CONFLICT (master_fn, username) DO NOTHING;

INSERT INTO role_permission (master_fn, role_id, permission_key, allowed)
SELECT 'M1', role.role_id, permission.permission_key, true
FROM role
JOIN (VALUES ('Company Admin','dashboard.read'),
  ('Company Admin','admin.users.invite'),
  ('Company Admin','admin.users.read'),
  ('Company Admin','admin.users.manage'),
  ('Company Admin','admin.roles.read'),
  ('Company Admin','admin.roles.write'),
  ('Company Admin','admin.modules.manage'),
  ('Company Admin','admin.audit.read'),
  ('Company Admin','settings.read'),
  ('Company Admin','settings.manage'),
  ('Company Admin','hr.read'),
  ('Company Admin','hr.write'),
  ('Manager','dashboard.read'),
  ('Manager','employee.self.read'),
  ('Manager','employee.team.read'),
  ('Manager','employee.leave.write'),
  ('Manager','employee.receipts.write'),
  ('Manager','employee.claims.write'),
  ('Manager','expenses.approve.manager'),
  ('Manager','sales.read'),
  ('Manager','crm.read'),
  ('Manager','inventory.read'),
  ('Manager','project.read'),
  ('Manager','service.read'),
  ('Manager','sales.approve'),
  ('Sales','dashboard.read'),
  ('Sales','sales.read'),
  ('Sales','sales.write'),
  ('Sales','sales.create'),
  ('Sales','sales.edit'),
  ('Sales','sales.export'),
  ('Sales','crm.read'),
  ('Sales','crm.write'),
  ('Sales','crm.create'),
  ('Sales','crm.edit'),
  ('Sales','crm.export'),
  ('Buyer','dashboard.read'),
  ('Buyer','purchasing.read'),
  ('Buyer','purchasing.write'),
  ('Buyer','purchasing.create'),
  ('Buyer','purchasing.edit'),
  ('Buyer','purchasing.export'),
  ('Buyer','inventory.read'),
  ('Warehouse','dashboard.read'),
  ('Warehouse','inventory.read'),
  ('Warehouse','inventory.write'),
  ('Warehouse','inventory.adjust'),
  ('Warehouse','inventory.transfer'),
  ('Warehouse','inventory.track'),
  ('Warehouse','warehouse.create'),
  ('Warehouse','warehouse.edit'),
  ('Warehouse','warehouse.post'),
  ('Production','dashboard.read'),
  ('Production','manufacturing.read'),
  ('Production','manufacturing.write'),
  ('Production','manufacturing.create'),
  ('Production','manufacturing.edit'),
  ('Production','manufacturing.post'),
  ('Production','inventory.read'),
  ('Production','quality.read'),
  ('Production','quality.write'),
  ('Finance Preparer','dashboard.read'),
  ('Finance Preparer','finance.read'),
  ('Finance Preparer','finance.write'),
  ('Finance Preparer','finance.create'),
  ('Finance Preparer','finance.edit'),
  ('Finance Preparer','finance.post'),
  ('Finance Preparer','finance.export'),
  ('Finance Preparer','expenses.finance.verify'),
  ('Finance Preparer','expenses.payment.prepare'),
  ('Finance Preparer','expenses.payment.export'),
  ('Finance Checker','dashboard.read'),
  ('Finance Checker','finance.read'),
  ('Finance Checker','finance.approve'),
  ('Finance Checker','finance.pay'),
  ('Finance Checker','finance.export'),
  ('Finance Checker','expenses.approve.finance'),
  ('Finance Checker','expenses.payment.release'),
  ('Finance Checker','expenses.payment.result.import'),
  ('HR','dashboard.read'),
  ('HR','hr.read'),
  ('HR','hr.write'),
  ('HR','hr.create'),
  ('HR','hr.edit'),
  ('HR','hr.approve'),
  ('HR','hr.export'),
  ('HR','payroll.read'),
  ('HR','payroll.write'),
  ('HR','admin.users.read'),
  ('HR','admin.roles.read'),
  ('Service','dashboard.read'),
  ('Service','service.read'),
  ('Service','service.write'),
  ('Service','service.create'),
  ('Service','service.edit'),
  ('Service','service.post'),
  ('Service','crm.read'),
  ('Viewer','dashboard.read'),
  ('Viewer','sales.read'),
  ('Viewer','purchasing.read'),
  ('Viewer','crm.read'),
  ('Viewer','inventory.read'),
  ('Viewer','manufacturing.read'),
  ('Viewer','quality.read'),
  ('Viewer','finance.read'),
  ('Viewer','hr.read'),
  ('Viewer','project.read'),
  ('Viewer','service.read'),
  ('Viewer','asset.read'),
  ('Viewer','reporting.read'),
  ('Viewer','integration.read')) permission(role_name,permission_key)
  ON permission.role_name=role.name
WHERE role.master_fn='M1' AND role.company_fn IN ('C-SG','C-MY')
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO role_resource_scope (master_fn, company_fn, role_id, resource_key, scope)
SELECT 'M1', role.company_fn, role.role_id, scoped.resource_key, scoped.scope
FROM role
JOIN (VALUES ('Company Admin','admin/*','company'),
  ('Company Admin','hr/*','company'),
  ('Manager','*','team'),
  ('Sales','sales/*','self'),
  ('Sales','crm/*','self'),
  ('Buyer','purchasing/*','company'),
  ('Buyer','inventory/*','company'),
  ('Warehouse','inventory/*','company'),
  ('Warehouse','warehouse/*','company'),
  ('Production','manufacturing/*','company'),
  ('Production','inventory/*','company'),
  ('Production','quality/*','company'),
  ('Finance Preparer','finance/*','company'),
  ('Finance Preparer','expenses/*','company'),
  ('Finance Checker','finance/*','company'),
  ('Finance Checker','expenses/*','company'),
  ('HR','hr/*','company'),
  ('HR','payroll/*','company'),
  ('Service','service/*','self'),
  ('Service','crm/*','self'),
  ('Viewer','*','company')) scoped(role_name,resource_key,scope)
  ON scoped.role_name=role.name
WHERE role.master_fn='M1' AND role.company_fn IN ('C-SG','C-MY')
ON CONFLICT (role_id, resource_key) DO NOTHING;

INSERT INTO user_company (user_id, company_fn, role_id)
SELECT app_user.user_id, assignment.company_fn, role.role_id
FROM (VALUES ('company-admin','C-SG','Company Admin'),
  ('manager','C-SG','Manager'),
  ('sales','C-SG','Sales'),
  ('buyer','C-SG','Buyer'),
  ('warehouse','C-SG','Warehouse'),
  ('production','C-SG','Production'),
  ('finance-preparer','C-SG','Finance Preparer'),
  ('finance-checker','C-SG','Finance Checker'),
  ('hr','C-SG','HR'),
  ('service','C-SG','Service'),
  ('finance-preparer','C-MY','Finance Preparer'),
  ('finance-checker','C-MY','Finance Checker'),
  ('hr','C-MY','HR')) assignment(username,company_fn,role_name)
JOIN app_user ON app_user.master_fn='M1' AND app_user.username=assignment.username
JOIN role ON role.master_fn='M1' AND role.company_fn=assignment.company_fn AND role.name=assignment.role_name
ON CONFLICT (user_id, company_fn) DO NOTHING;

INSERT INTO user_company_role (user_id, company_fn, role_id)
SELECT membership.user_id, membership.company_fn, membership.role_id
FROM user_company membership
JOIN app_user ON app_user.user_id=membership.user_id
WHERE app_user.master_fn='M1' AND app_user.username IN ('company-admin','manager','sales','buyer','warehouse','production','finance-preparer','finance-checker','hr','service')
ON CONFLICT (user_id, company_fn, role_id) DO NOTHING;


INSERT INTO warehouse (master_fn, company_fn, code, name)
VALUES ('M1','C-SG','DEMO-SG-MAIN','Singapore Demo Main'),
       ('M1','C-MY','DEMO-MY-MAIN','Malaysia Demo Main')
ON CONFLICT (master_fn, company_fn, code) DO NOTHING;

INSERT INTO account (master_fn, company_fn, code, name, type)
SELECT 'M1', c.company_fn, a.code, a.name, a.type
FROM (VALUES ('C-SG'),('C-MY')) c(company_fn)
CROSS JOIN (VALUES
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

UPDATE employee SET user_id=app_user.user_id
FROM app_user
WHERE employee.master_fn='M1' AND app_user.master_fn='M1'
  AND (employee.company_fn, employee.employee_no, app_user.username) IN (
    ('C-SG','DEMO-SG-E001','company-admin'), ('C-SG','DEMO-SG-E002','manager'),
    ('C-SG','DEMO-SG-E003','sales'), ('C-SG','DEMO-SG-E004','buyer'),
    ('C-SG','DEMO-SG-E005','warehouse'), ('C-SG','DEMO-SG-E006','production'),
    ('C-SG','DEMO-SG-E007','finance-preparer'), ('C-SG','DEMO-SG-E008','finance-checker'),
    ('C-SG','DEMO-SG-E009','hr'), ('C-SG','DEMO-SG-E010','service'),
    ('C-MY','DEMO-MY-E001','finance-preparer'), ('C-MY','DEMO-MY-E002','finance-checker'),
    ('C-MY','DEMO-MY-E003','hr')
  );

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
VALUES ('demo_showcase_pack', '{"version":"1","businessDate":"2026-07-27","records":10000}'::jsonb, now())
ON CONFLICT (key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

COMMIT;
