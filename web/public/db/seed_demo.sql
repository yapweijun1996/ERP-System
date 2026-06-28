-- ============================================================
-- Aria ERP — demo volume data
-- Loaded AFTER seed.sql. Adds extra masters + ~12 months of
-- procedurally generated transactions so listings, AR/AP aging,
-- the revenue trend and pipeline all look like a live system.
-- "today" for aging purposes is ~2026-06-20.
-- ============================================================

-- ---------- additional master data ----------
INSERT INTO customer (id,name,industry,terms,credit_limit,owner,since,status) VALUES
  ('CUST-0119','Vertex Machine Tools','Machine Tools','Net 30',200000,'Lena Park','2021','Active'),
  ('CUST-0188','Pinnacle Foods Sdn','Food Processing','Net 30',150000,'Lena Park','2022','On hold'),
  ('CUST-0301','Helix Medical Devices','Medical','Net 45',260000,'Priya Nathan','2020','Active'),
  ('CUST-0312','Cascade Energy','Energy','Net 60',340000,'Liam Cardoso','2019','Active'),
  ('CUST-0334','Summit Mining Equipment','Mining','Net 30',280000,'Priya Nathan','2023','Active');

INSERT INTO supplier (id,name,terms,currency) VALUES
  ('S-0155','AlumaTech Profiles','Net 30','USD'),
  ('S-0160','Pacific Fasteners','Net 30','USD'),
  ('S-0171','Nordic Electronics','Net 45','EUR');

INSERT INTO item (sku,name,category,uom,std_cost,reorder,on_hand) VALUES
  ('NW-1300','Servo Motor 750W','Drive Units','ea',288.00,20,46),
  ('NW-4500','Planetary Gearbox','Drive Units','ea',412.00,15,22),
  ('NW-9100','6-Axis Robotic Arm','Drive Units','ea',8600.00,2,5),
  ('NW-5600','Valve Block Manifold','Pneumatics','ea',164.00,25,60),
  ('NW-6700','Cable Harness Loom','Components','ea',38.00,80,310),
  ('NW-2200','Steel Rod 20mm','Raw Materials','m',6.20,150,540),
  ('NW-7720','Legacy Controller v1','Components','ea',300.00,0,62),
  ('NW-8810','Obsolete Sensor Kit','Components','ea',70.00,0,130);

INSERT INTO employee (id,name,dept,role,manager_id,emp_type,status,joined,monthly_salary) VALUES
  ('EMP-1088','Lena Park','Sales','Account Executive','EMP-1001','Full-time','Active','2023',5200),
  ('EMP-1071','Tom Becker','Production','Production Line Lead','EMP-1001','Full-time','Active','2022',3900),
  ('EMP-1126','Priya Nathan','Projects','Project Manager','EMP-1001','Full-time','Active','2022',8400),
  ('EMP-1140','Samuel Boateng','IT','Systems Analyst','EMP-1001','Contract','Probation','2024',5400),
  ('EMP-1155','Rosa Delgado','Service','Service Coordinator','EMP-1001','Full-time','Active','2023',4600),
  ('EMP-1160','Tom Fielding','Service','Field Technician','EMP-1155','Full-time','Active','2022',4100);

INSERT INTO gl_account (code,name,type,normal_side) VALUES
  ('1010','Cash at bank — CIMB MYR','Assets','Dr'),
  ('1210','Inventory — Work in progress','Assets','Dr'),
  ('1220','Inventory — Finished goods','Assets','Dr'),
  ('1510','Accumulated depreciation','Assets','Cr'),
  ('2200','Accrued payroll','Liabilities','Cr'),
  ('2500','Bank loan — term','Liabilities','Cr'),
  ('3000','Share capital','Equity','Cr'),
  ('4100','Sales — Service & contracts','Income','Cr'),
  ('6100','Rent & utilities','Expenses','Dr'),
  ('6200','Depreciation expense','Expenses','Dr');

-- ============================================================
-- procedural transactions
-- ============================================================

-- ---- 90 historical sales invoices spread across 12 months ----
INSERT INTO sales_invoice (no, customer_id, invoice_date, due_date, tax_code, shipping, status)
SELECT 'INV-H-'||lpad(g::text,4,'0'),
       (ARRAY['CUST-0007','CUST-0102','CUST-0210','CUST-0044','CUST-0231',
              'CUST-0119','CUST-0301','CUST-0312','CUST-0334','CUST-0188'])[1 + (g % 10)],
       dt, dt + 30, 'SR', (g % 4) * 120,
       CASE
         WHEN dt + 30 < DATE '2026-06-20' AND g % 5 = 0 THEN 'Overdue'
         WHEN g % 4 = 0 THEN 'Partially Paid'
         ELSE 'Paid'
       END
FROM generate_series(1,90) g,
     LATERAL (SELECT DATE '2025-07-05' + (g * 4) AS dt) s;

-- two lines per historical invoice
INSERT INTO invoice_line (inv_no, sku, qty, unit_price, disc_pct)
SELECT 'INV-H-'||lpad(g::text,4,'0'),
       (ARRAY['NW-9001','NW-1042','NW-5500','NW-3310','NW-4402','NW-1300','NW-4500','NW-5600'])[1 + ((g + ln) % 8)],
       5 + ((g * 3 + ln) % 40),
       60 + ((g * 37 + ln * 11) % 1400),
       (g % 3) * 5
FROM generate_series(1,90) g, generate_series(1,2) ln;

-- settle the fully-paid invoices in full; partial invoices ~50%
INSERT INTO invoice_payment (inv_no, pay_date, method, amount)
SELECT no, due_date, 'Bank transfer', total
FROM v_invoice_totals WHERE no LIKE 'INV-H-%' AND status = 'Paid';

INSERT INTO invoice_payment (inv_no, pay_date, method, amount)
SELECT no, due_date - 5, 'Bank transfer', round(total * 0.5, 2)
FROM v_invoice_totals WHERE no LIKE 'INV-H-%' AND status = 'Partially Paid';

-- ---- 50 historical sales orders (for order listings) ----
INSERT INTO sales_order (no, customer_id, order_date, deliver_by, status, currency, owner)
SELECT 'SO-H-'||lpad(g::text,4,'0'),
       (ARRAY['CUST-0007','CUST-0102','CUST-0210','CUST-0044','CUST-0231',
              'CUST-0119','CUST-0301','CUST-0312','CUST-0334'])[1 + (g % 9)],
       dt, dt + 14,
       (ARRAY['Completed','Completed','Completed','Approved','Partially Completed','Cancelled'])[1 + (g % 6)],
       'USD',
       (ARRAY['J. Okafor','L. Tan','Lena Park'])[1 + (g % 3)]
FROM generate_series(1,50) g,
     LATERAL (SELECT DATE '2025-09-01' + (g * 5) AS dt) s;

INSERT INTO sales_order_line (so_no, line_no, sku, qty, unit_price, disc_pct)
SELECT 'SO-H-'||lpad(g::text,4,'0'), ln,
       (ARRAY['NW-9001','NW-1042','NW-5500','NW-3310','NW-6700','NW-2200'])[1 + ((g * ln) % 6)],
       4 + ((g + ln * 7) % 30),
       50 + ((g * 23 + ln * 9) % 1200),
       (g % 4) * 4
FROM generate_series(1,50) g, generate_series(1,2) ln;

-- ---- 50 purchase orders + lines ----
INSERT INTO purchase_order (no, supplier_id, order_date, expected, status, buyer, budget, currency)
SELECT 'PO-H-'||lpad(g::text,4,'0'),
       (ARRAY['S-0140','S-0118','S-0102','S-0155','S-0160','S-0171'])[1 + (g % 6)],
       dt, dt + 18,
       (ARRAY['Completed','Completed','Approved','Partially Completed','Pending Approval'])[1 + (g % 5)],
       (ARRAY['R. Haddad','A. Bauer'])[1 + (g % 2)],
       20000 + (g % 8) * 9000,
       (ARRAY['USD','USD','EUR'])[1 + (g % 3)]
FROM generate_series(1,50) g,
     LATERAL (SELECT DATE '2025-09-10' + (g * 5) AS dt) s;

INSERT INTO po_line (po_no, sku, qty, unit_price)
SELECT 'PO-H-'||lpad(g::text,4,'0'),
       (ARRAY['NW-1180','NW-3310','NW-3315','NW-2200','NW-6700','NW-4402'])[1 + ((g + ln) % 6)],
       50 + ((g * 13 + ln) % 1500),
       3 + ((g * 7 + ln * 3) % 130)
FROM generate_series(1,50) g, generate_series(1,2) ln;

-- ---- 36 supplier invoices (AP) ----
INSERT INTO supplier_invoice (no, po_no, supplier_id, invoice_date, due_date, status)
SELECT 'SI-H-'||lpad(g::text,4,'0'),
       'PO-H-'||lpad(g::text,4,'0'),
       (ARRAY['S-0140','S-0118','S-0102','S-0155','S-0160','S-0171'])[1 + (g % 6)],
       dt, dt + 30,
       (ARRAY['Posted','Posted','Paid','Matched','Pending Approval'])[1 + (g % 5)]
FROM generate_series(1,36) g,
     LATERAL (SELECT DATE '2025-10-01' + (g * 6) AS dt) s;

-- ---- 24 balanced monthly journal entries ----
INSERT INTO journal_entry (no, entry_date, period, memo, source, status)
SELECT 'JE-H-'||lpad(g::text,4,'0'),
       dt, 'FY2026 · P'||lpad((1 + (g % 12))::text,2,'0'),
       (ARRAY['Monthly sales posting','COGS recognition','Payroll accrual','Depreciation run','Bank charges'])[1 + (g % 5)],
       (ARRAY['Sales','Inventory','Payroll','Fixed Assets','Bank'])[1 + (g % 5)],
       'Posted'
FROM generate_series(1,24) g,
     LATERAL (SELECT DATE '2025-07-15' + (g * 14) AS dt) s;

-- two balancing lines per journal (Dr = Cr)
INSERT INTO journal_line (je_no, account_code, dr, cr, dimension)
SELECT 'JE-H-'||lpad(g::text,4,'0'), drcode, amt, 0, dim FROM (
  SELECT g,
         (ARRAY['1100','5000','6000','6200','6100'])[1 + (g % 5)] AS drcode,
         (ARRAY['4000','1220','2200','1510','1000'])[1 + (g % 5)] AS crcode,
         (8000 + (g * 1700) % 42000)::numeric AS amt,
         (ARRAY['Sales','COGS','Payroll','Depreciation','Opex'])[1 + (g % 5)] AS dim
  FROM generate_series(1,24) g) x;
INSERT INTO journal_line (je_no, account_code, dr, cr, dimension)
SELECT 'JE-H-'||lpad(g::text,4,'0'), crcode, 0, amt, dim FROM (
  SELECT g,
         (ARRAY['1100','5000','6000','6200','6100'])[1 + (g % 5)] AS drcode,
         (ARRAY['4000','1220','2200','1510','1000'])[1 + (g % 5)] AS crcode,
         (8000 + (g * 1700) % 42000)::numeric AS amt,
         (ARRAY['Sales','COGS','Payroll','Depreciation','Opex'])[1 + (g % 5)] AS dim
  FROM generate_series(1,24) g) x;

-- ---- 20 sales-pipeline opportunities ----
INSERT INTO opportunity (no, customer_id, title, stage, value, probability, owner, close_date)
SELECT 'OPP-H-'||lpad(g::text,4,'0'),
       (ARRAY['CUST-0007','CUST-0102','CUST-0231','CUST-0301','CUST-0312','CUST-0334','CUST-0119'])[1 + (g % 7)],
       (ARRAY['Automation cell upgrade','Spare parts contract','Conveyor retrofit','Robotic arm fleet','Maintenance agreement','Custom fixture build'])[1 + (g % 6)],
       (ARRAY['Lead','Qualified','Proposal','Negotiation','Won','Lost'])[1 + (g % 6)],
       40000 + (g * 8300) % 260000,
       (ARRAY[15,30,50,70,100,0])[1 + (g % 6)],
       (ARRAY['J. Okafor','Lena Park','Priya Nathan'])[1 + (g % 3)],
       DATE '2026-06-01' + (g * 6)
FROM generate_series(1,20) g;

-- ---- 16 service tickets ----
INSERT INTO service_ticket (no, customer_id, subject, priority, status, opened, technician)
SELECT 'SVC-H-'||lpad(g::text,4,'0'),
       (ARRAY['CUST-0007','CUST-0102','CUST-0210','CUST-0334','CUST-0301'])[1 + (g % 5)],
       (ARRAY['Drive fault on line','Calibration request','Spare part replacement','Preventive maintenance','Software update'])[1 + (g % 5)],
       (ARRAY['Low','Medium','High','Critical'])[1 + (g % 4)],
       (ARRAY['Open','In Progress','Scheduled','Resolved','Closed'])[1 + (g % 5)],
       DATE '2026-05-01' + (g * 3),
       (ARRAY['Tom Fielding','Rosa Delgado'])[1 + (g % 2)]
FROM generate_series(1,16) g;

-- ---- 12 work orders ----
INSERT INTO work_order (no, sku, qty, status, start_date, due_date, warehouse)
SELECT 'WO-H-'||lpad(g::text,4,'0'),
       (ARRAY['NW-9001','NW-1042','NW-1300','NW-4500','NW-9100'])[1 + (g % 5)],
       5 + (g % 40),
       (ARRAY['Planned','Released','In Progress','Completed','Completed'])[1 + (g % 5)],
       DATE '2026-05-10' + (g * 3),
       DATE '2026-05-24' + (g * 3),
       'KL-Main'
FROM generate_series(1,12) g;

-- ---- 24 stock movements ----
INSERT INTO stock_movement (sku, move_date, move_type, ref_doc, qty, balance, warehouse)
SELECT (ARRAY['NW-3310','NW-1042','NW-9001','NW-6700','NW-2200','NW-4402'])[1 + (g % 6)],
       DATE '2026-05-20' + (g % 30),
       (ARRAY['Goods Receipt','Goods Issue','Transfer Out','Adjustment'])[1 + (g % 4)],
       'MV-26-'||lpad(g::text,4,'0'),
       (CASE WHEN g % 2 = 0 THEN 1 ELSE -1 END) * (10 + (g * 7) % 300),
       NULL, 'KL-Main'
FROM generate_series(1,24) g;

-- ---------- platform master accounts (tenants) ----------
INSERT INTO master_account (id,name,plan,region,status,owner,modules,is_current) VALUES
  ('MST-0001','Northwind Group','Enterprise','APAC · Kuala Lumpur','Active','Dana Reyes',14,true),
  ('MST-0002','Apex Industrial Holdings','Business','APAC · Singapore','Active','Clarence Lim',10,false),
  ('MST-0003','Coastal Packaging Co','Business','APAC · Penang','Active','Mei Tan',8,false),
  ('MST-0004','Meridian Robotics','Enterprise','NA · San Francisco','Active','Elena Marsh',16,false),
  ('MST-0005','Pinnacle Foods Mfg','Starter','APAC · Johor','Suspended','—',5,false);

INSERT INTO master_company (id,master_id,name,cur,branches,status,is_current) VALUES
  ('CMP-1001','MST-0001','Northwind Manufacturing','USD',3,'Active',true),
  ('CMP-1002','MST-0001','Northwind Logistics','USD',2,'Active',false),
  ('CMP-1003','MST-0001','Northwind Trading (SG)','SGD',1,'Active',false),
  ('CMP-2001','MST-0002','Apex Industrial Pte','SGD',2,'Active',false),
  ('CMP-2002','MST-0002','Apex Components','SGD',1,'Active',false),
  ('CMP-3001','MST-0003','Coastal Packaging Sdn','MYR',1,'Active',false),
  ('CMP-4001','MST-0004','Meridian Robotics Inc','USD',2,'Active',false),
  ('CMP-4002','MST-0004','Meridian Automation','USD',1,'Active',false),
  ('CMP-4003','MST-0004','Meridian EU GmbH','EUR',1,'Active',false),
  ('CMP-5001','MST-0005','Pinnacle Foods Sdn','MYR',1,'Suspended',false);

INSERT INTO master_user (id,master_id,name,email,role,access,status,last_active) VALUES
  ('USR-2001','MST-0001','Dana Reyes','dana.reyes@northwind.co','Operations Director','All companies','Active','Online'),
  ('USR-2002','MST-0001','Priya Nwosu','p.nwosu@northwind.co','CFO','All companies','Active','2h ago'),
  ('USR-2003','MST-0001','James Okafor','j.okafor@northwind.co','Sales User','Manufacturing','Active','12m ago'),
  ('USR-2004','MST-0001','Raj Haddad','r.haddad@northwind.co','Purchase User','Mfg · Logistics','Active','1h ago'),
  ('USR-2005','MST-0001','Marcus Silva','m.silva@northwind.co','Warehouse User','Manufacturing','Active','30m ago'),
  ('USR-2006','MST-0001','Lena Park','l.park@northwind.co','Sales User','Trading (SG)','Suspended','14d ago'),
  ('USR-3001','MST-0002','Clarence Lim','c.lim@apex.sg','Admin','All companies','Active','1d ago'),
  ('USR-3002','MST-0002','Wei Tan','w.tan@apex.sg','Finance User','All companies','Active','3h ago'),
  ('USR-3003','MST-0002','Nadia Yusof','n.yusof@apex.sg','Purchase User','Components','Active','5h ago'),
  ('USR-4001','MST-0003','Mei Tan','mei@coastalpkg.my','Admin','All companies','Active','4h ago'),
  ('USR-4002','MST-0003','Arif Rahman','arif@coastalpkg.my','Sales User','All companies','Active','1d ago'),
  ('USR-5001','MST-0004','Elena Marsh','e.marsh@meridian.co','Admin','All companies','Active','20m ago'),
  ('USR-5002','MST-0004','David Cho','d.cho@meridian.co','Purchase User','Robotics Inc','Active','2h ago'),
  ('USR-5003','MST-0004','Sofia Reyes','s.reyes@meridian.co','Finance User','All companies','Active','6h ago'),
  ('USR-6001','MST-0005','Hassan Ali','hassan@pinnaclefoods.my','Admin','All companies','Suspended','30d ago'),
  ('USR-6002','MST-0005','Grace Wong','grace@pinnaclefoods.my','Sales User','All companies','Suspended','30d ago');
