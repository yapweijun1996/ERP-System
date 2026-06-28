-- ============================================================
-- Aria ERP — seed data (Northwind Manufacturing demo)
-- Mirrors the prototype's order-to-cash & procure-to-pay chains
-- so joins/views return the same numbers shown in the UI.
-- ============================================================

INSERT INTO company (id,name,base_currency,fiscal_year,branch) VALUES
  ('CMP-1001','Northwind Manufacturing','USD','FY2026 · Jan–Dec','Kuala Lumpur HQ');

INSERT INTO currency (code,name,rate_to_usd,is_base) VALUES
  ('USD','US Dollar',1.0000,true),
  ('MYR','Malaysian Ringgit',4.7120,false),
  ('EUR','Euro',0.9230,false),
  ('SGD','Singapore Dollar',1.3480,false),
  ('CNY','Chinese Yuan',7.2410,false);

INSERT INTO tax_code (code,name,rate,kind) VALUES
  ('SR','Standard-rated GST',6.0,'Output'),
  ('ZR','Zero-rated (export)',0.0,'Output'),
  ('TX','Input tax — purchases',6.0,'Input'),
  ('EX','Exempt supply',0.0,'Output'),
  ('WHT','Withholding tax — services',10.0,'Withholding');

INSERT INTO gl_account (code,name,type,normal_side) VALUES
  ('1000','Cash at bank — HSBC Operating','Assets','Dr'),
  ('1100','Accounts Receivable','Assets','Dr'),
  ('1200','Inventory — Raw materials','Assets','Dr'),
  ('1500','Property, plant & equipment','Assets','Dr'),
  ('2000','Accounts Payable','Liabilities','Cr'),
  ('2100','GST / Tax payable','Liabilities','Cr'),
  ('3100','Retained earnings','Equity','Cr'),
  ('4000','Sales — Products','Income','Cr'),
  ('5000','Cost of goods sold','Expenses','Dr'),
  ('6000','Salaries & wages','Expenses','Dr');

INSERT INTO customer (id,name,industry,terms,credit_limit,owner,since,status) VALUES
  ('CUST-0007','Meridian Robotics','Industrial Automation','Net 30',240000,'Liam Cardoso','2020','Active'),
  ('CUST-0102','Apex Industrial','Heavy Machinery','Net 30',300000,'Priya Nathan','2019','Active'),
  ('CUST-0210','Delta Process Systems','Process Plant','Net 60',180000,'Lena Park','2021','Active'),
  ('CUST-0044','Harbor Freight Co.','Logistics','Net 30',120000,'Liam Cardoso','2018','Active'),
  ('CUST-0231','Orion Aerospace','Aerospace','Net 45',400000,'Priya Nathan','2022','Active');

INSERT INTO supplier (id,name,terms,currency) VALUES
  ('S-0140','Shenzhen Microcircuit','Net 30','USD'),
  ('S-0118','EuroSteel Trading','Net 30','EUR'),
  ('S-0102','Daido Precision Ltd','Net 30','USD');

INSERT INTO item (sku,name,category,uom,std_cost,reorder,on_hand) VALUES
  ('NW-9001','Conveyor Drive Unit','Drive Units','ea',1480.00,5,14),
  ('NW-1042','Hydraulic Pump Assembly','Components','ea',248.00,40,88),
  ('NW-5500','Pneumatic Cylinder 32mm','Pneumatics','ea',96.00,30,4),
  ('NW-3310','Industrial Bearing 6204','Components','ea',6.80,200,640),
  ('NW-3315','Industrial Bearing 6206','Components','ea',9.40,200,420),
  ('NW-4402','Aluminium Extrusion 40×40','Raw Materials','m',13.40,120,264),
  ('NW-6610','Carton Box 600×400×300','Packaging','ea',1.85,500,1640),
  ('NW-2271','Stainless Steel Sheet 2mm','Raw Materials','sheet',42.50,30,14),
  ('NW-1180','Control Module PCB v3','Components','ea',118.00,50,0);

INSERT INTO employee (id,name,dept,role,manager_id,emp_type,status,joined,monthly_salary) VALUES
  ('EMP-1001','Dana Reyes','Operations','Operations Director',NULL,'Full-time','Active','2019',12000),
  ('EMP-1042','Marcus Silva','Warehouse','Warehouse Supervisor','EMP-1001','Full-time','On leave','2021',4200),
  ('EMP-1055','Aisha Rahman','Finance','Senior Accountant','EMP-1001','Full-time','Active','2020',6800),
  ('EMP-1102','Liam Cardoso','Projects','Project Manager','EMP-1001','Full-time','Active','2020',8400),
  ('EMP-1119','Aisha Karim','Engineering','Lead Controls Engineer','EMP-1102','Full-time','Active','2019',7600),
  ('EMP-1090','Raj Haddad','Purchasing','Procurement Buyer','EMP-1001','Full-time','Active','2021',5600);

-- ===== order-to-cash chain: SO-26-0418 → DO-26-0204 → INV-26-0331 =====
INSERT INTO sales_order (no,customer_id,order_date,deliver_by,status,currency,owner,cust_ref) VALUES
  ('SO-26-0418','CUST-0007','2026-06-03','2026-06-18','Pending Approval','USD','J. Okafor','PO# MR-99821'),
  ('SO-26-0417','CUST-0102','2026-06-02','2026-06-20','Approved','USD','L. Tan',NULL);

INSERT INTO sales_order_line (so_no,line_no,sku,qty,unit_price,disc_pct) VALUES
  ('SO-26-0418',1,'NW-9001',9,1480.00,10),
  ('SO-26-0418',2,'NW-1042',24,312.00,12),
  ('SO-26-0418',3,'NW-5500',30,96.00,12),
  ('SO-26-0418',4,'NW-3310',200,9.20,5),
  ('SO-26-0418',5,'NW-4402',120,13.40,0),
  ('SO-26-0418',6,'NW-6610',300,1.85,0);

INSERT INTO delivery (no,so_no,ship_date,warehouse,carrier,tracking,status) VALUES
  ('DO-26-0204','SO-26-0418','2026-06-16','KL-Main','DHL Express','JD0149820236','In transit');

INSERT INTO delivery_line (do_no,sku,ordered,delivered) VALUES
  ('DO-26-0204','NW-9001',9,9),
  ('DO-26-0204','NW-1042',24,24),
  ('DO-26-0204','NW-5500',30,4),
  ('DO-26-0204','NW-3310',200,200),
  ('DO-26-0204','NW-4402',120,120),
  ('DO-26-0204','NW-6610',300,300);

INSERT INTO sales_invoice (no,so_no,do_no,customer_id,invoice_date,due_date,tax_code,shipping,status) VALUES
  ('INV-26-0331','SO-26-0418','DO-26-0204','CUST-0007','2026-06-16','2026-07-16','SR',850.00,'Partially Paid');

INSERT INTO invoice_line (inv_no,sku,qty,unit_price,disc_pct) VALUES
  ('INV-26-0331','NW-9001',9,1480.00,10),
  ('INV-26-0331','NW-1042',24,312.00,12),
  ('INV-26-0331','NW-5500',4,96.00,12),
  ('INV-26-0331','NW-3310',200,9.20,5),
  ('INV-26-0331','NW-4402',120,13.40,0),
  ('INV-26-0331','NW-6610',300,1.85,0);

INSERT INTO invoice_payment (inv_no,pay_date,method,amount) VALUES
  ('INV-26-0331','2026-06-18','Bank transfer',15000.00);

-- a couple of overdue invoices to populate AR aging
INSERT INTO sales_invoice (no,so_no,do_no,customer_id,invoice_date,due_date,tax_code,shipping,status) VALUES
  ('INV-26-0288','SO-26-0417',NULL,'CUST-0102','2026-04-20','2026-05-20','SR',0,'Overdue'),
  ('INV-26-0271',NULL,NULL,'CUST-0044','2026-03-02','2026-04-01','SR',0,'Overdue');
INSERT INTO invoice_line (inv_no,sku,qty,unit_price,disc_pct) VALUES
  ('INV-26-0288','NW-9001',30,1480.00,0),
  ('INV-26-0271','NW-1042',60,312.00,0);

-- ===== procure-to-pay chain: PO-26-0291 → GRN-26-0188 → SI-26-0615 =====
INSERT INTO purchase_order (no,supplier_id,order_date,expected,status,buyer,budget,currency) VALUES
  ('PO-26-0291','S-0140','2026-06-04','2026-06-22','Pending Approval','R. Haddad',66000,'USD');

INSERT INTO po_line (po_no,sku,qty,unit_price) VALUES
  ('PO-26-0291','NW-1180',300,118.00),
  ('PO-26-0291','NW-3310',1500,6.80),
  ('PO-26-0291','NW-3315',1000,9.40);

INSERT INTO goods_receipt (no,po_no,supplier_id,receipt_date,warehouse,status) VALUES
  ('GRN-26-0188','PO-26-0291','S-0140','2026-06-04','KL-Main','QC hold');

INSERT INTO grn_line (grn_no,sku,ordered,received) VALUES
  ('GRN-26-0188','NW-1180',300,300),
  ('GRN-26-0188','NW-3310',1500,1500),
  ('GRN-26-0188','NW-3315',1000,600);

INSERT INTO supplier_invoice (no,po_no,grn_no,supplier_id,invoice_date,due_date,status) VALUES
  ('SI-26-0615','PO-26-0291','GRN-26-0188','S-0140','2026-06-05','2026-07-05','Pending Approval');

-- ===== finance: a posted journal =====
INSERT INTO journal_entry (no,entry_date,period,memo,source,status) VALUES
  ('JE-26-0611','2026-06-04','FY2026 · P06','FX revaluation — EUR payables','FX engine','Posted');
INSERT INTO journal_line (je_no,account_code,dr,cr,dimension) VALUES
  ('JE-26-0611','2000',1820.00,0,'AP-EUR'),
  ('JE-26-0611','5000',0,1820.00,'FX gain');

-- ===== projects =====
INSERT INTO project (no,name,customer_id,project_type,pm,contract_value,cost_to_date,pct_complete,status,start_date,due_date) VALUES
  ('PRJ-26-014','Meridian Robotics — Cell Integration','CUST-0007','Customer','Liam Cardoso',486000,358200,74,'On track','2026-03-04','2026-08-15'),
  ('PRJ-26-021','Plant 2 Automation Retrofit',NULL,'Internal','Dana Reyes',720000,196400,26,'On track','2026-04-18','2026-11-30');

-- ===== payroll =====
INSERT INTO payroll_run (period,pay_date,status) VALUES
  ('June 2026','2026-06-28','Pending Approval');
INSERT INTO payslip (run_period,employee_id,gross,epf,tax) VALUES
  ('June 2026','EMP-1001',12000,1320,1980),
  ('June 2026','EMP-1055',6800,748,690),
  ('June 2026','EMP-1102',8400,924,1010),
  ('June 2026','EMP-1119',7600,836,860),
  ('June 2026','EMP-1090',5600,616,480),
  ('June 2026','EMP-1042',4200,462,210);

-- ===== admin: users & audit =====
INSERT INTO app_user (id,name,email,role,status,mfa,last_active,employee_id) VALUES
  ('USR-2001','Dana Reyes','dana.reyes@northwind.co','Admin','Active',true,'2m ago','EMP-1001'),
  ('USR-2002','Aisha Rahman','a.rahman@northwind.co','Finance User','Active',true,'1h ago','EMP-1055'),
  ('USR-2003','Raj Haddad','r.haddad@northwind.co','Purchase User','Active',true,'3h ago','EMP-1090'),
  ('USR-2005','Marcus Silva','m.silva@northwind.co','Warehouse User','Active',true,'4h ago','EMP-1042'),
  ('USR-2009','Tom Becker','t.becker@northwind.co','Approver','Disabled',false,'30d ago',NULL),
  ('USR-2010','External Auditor','audit@kpmg.example','Auditor','Active',true,'1d ago',NULL);

INSERT INTO audit_log (app_user,action,object,kind,ip,success) VALUES
  ('Dana Reyes','Approved purchase order','PO-26-0291','approval','10.0.4.21',true),
  ('Aisha Rahman','Posted journal to GL','JE-26-0611','post','10.0.4.08',true),
  ('Samuel Boateng','Failed login (bad password)',NULL,'security','88.21.4.119',false),
  ('Dana Reyes','Changed role permission','Sales User · Edit→Full','permission','10.0.4.21',true),
  ('Marcus Silva','Posted goods receipt','GRN-26-0188','post','10.0.7.12',true);

-- ===== inventory ledger =====
INSERT INTO stock_movement (sku,move_date,move_type,ref_doc,qty,balance,warehouse) VALUES
  ('NW-1042','2026-06-04','Goods Issue','DO-26-0204',-24,88,'KL-Main'),
  ('NW-3310','2026-06-04','Goods Receipt','GRN-26-0188',1500,640,'KL-Main'),
  ('NW-2271','2026-06-04','Adjustment','ADJ-26-0044',-6,14,'KL-Main'),
  ('NW-5500','2026-06-03','Transfer Out','WT-26-0091',-20,4,'KL-Main');

-- ===== manufacturing =====
INSERT INTO work_order (no,sku,qty,status,start_date,due_date,warehouse,so_no) VALUES
  ('WO-26-0081','NW-9001',15,'On Hold','2026-06-08','2026-06-20','KL-Main','SO-26-0418'),
  ('WO-26-0079','NW-1042',60,'In Progress','2026-06-05','2026-06-18','KL-Main',NULL);

-- ===== quality =====
INSERT INTO qc_inspection (no,ref_doc,sku,kind,status,inspected_by,inspect_date) VALUES
  ('QC-26-0140','GRN-26-0188','NW-1180','Incoming','Scheduled',NULL,NULL),
  ('QC-26-0138','WO-26-0079','NW-1042','In-process','Pass','A. Karim','2026-06-06');

-- ===== service =====
INSERT INTO service_ticket (no,customer_id,subject,priority,status,opened,technician) VALUES
  ('SVC-26-0042','CUST-0102','Drive unit vibration on Line 3','High','In Progress','2026-06-10','Tom Fielding'),
  ('SVC-26-0040','CUST-0007','Annual maintenance — robotics cell','Medium','Scheduled','2026-06-12','Rosa Delgado');

-- ===== fixed assets =====
INSERT INTO fixed_asset (id,name,category,acquired,cost,accum_dep,status) VALUES
  ('FA-1001','CNC Machining Centre','Plant & Machinery','2022-03-01',420000,168000,'In use'),
  ('FA-1014','Forklift — Toyota 2.5T','Vehicles','2023-07-15',86000,28600,'In use'),
  ('FA-1022','Assembly Line Conveyor','Plant & Machinery','2021-01-10',310000,155000,'Under maintenance');

-- ===== CRM =====
INSERT INTO opportunity (no,customer_id,title,stage,value,probability,owner,close_date) VALUES
  ('OPP-26-0091','CUST-0007','9× Conveyor Drive Units','Negotiation',96420,80,'J. Okafor','2026-06-18'),
  ('OPP-26-0088','CUST-0231','Aerospace fixture retrofit','Proposal',184000,55,'Priya Nathan','2026-07-30'),
  ('OPP-26-0084','CUST-0210','Process line spares contract','Qualified',64000,40,'Lena Park','2026-08-15');
