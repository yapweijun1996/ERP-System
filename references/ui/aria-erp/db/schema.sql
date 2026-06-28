-- ============================================================
-- Aria ERP — core database schema (PostgreSQL)
-- Runs in PGlite (in-browser Postgres) today; identical DDL
-- targets a real PostgreSQL server in production.
-- ============================================================

-- ---------- master data ----------
CREATE TABLE company (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  base_currency text NOT NULL DEFAULT 'USD',
  fiscal_year   text,
  branch        text
);

CREATE TABLE currency (
  code        text PRIMARY KEY,           -- ISO 4217
  name        text NOT NULL,
  rate_to_usd numeric(12,4) NOT NULL,
  is_base     boolean NOT NULL DEFAULT false
);

CREATE TABLE tax_code (
  code   text PRIMARY KEY,
  name   text NOT NULL,
  rate   numeric(5,2) NOT NULL,
  kind   text NOT NULL CHECK (kind IN ('Output','Input','Withholding')),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE gl_account (
  code        text PRIMARY KEY,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('Assets','Liabilities','Equity','Income','Expenses')),
  normal_side text NOT NULL CHECK (normal_side IN ('Dr','Cr'))
);

CREATE TABLE customer (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  industry     text,
  terms        text DEFAULT 'Net 30',
  credit_limit numeric(14,2) DEFAULT 0,
  owner        text,
  since        text,
  status       text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','On hold','Closed'))
);

CREATE TABLE supplier (
  id       text PRIMARY KEY,
  name     text NOT NULL,
  terms    text DEFAULT 'Net 30',
  currency text REFERENCES currency(code) DEFAULT 'USD'
);

CREATE TABLE item (
  sku      text PRIMARY KEY,
  name     text NOT NULL,
  category text,
  uom      text NOT NULL DEFAULT 'ea',
  std_cost numeric(12,2) NOT NULL DEFAULT 0,
  reorder  integer DEFAULT 0,
  on_hand  integer DEFAULT 0
);

CREATE TABLE employee (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  dept           text,
  role           text,
  manager_id     text REFERENCES employee(id),
  emp_type       text CHECK (emp_type IN ('Full-time','Contract')),
  status         text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','On leave','Probation','Resigned')),
  joined         text,
  monthly_salary numeric(12,2)
);

-- ---------- order to cash ----------
CREATE TABLE sales_order (
  no          text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customer(id),
  order_date  date,
  deliver_by  date,
  status      text NOT NULL CHECK (status IN ('Draft','Pending Approval','Approved','Partially Completed','Completed','Cancelled')),
  currency    text REFERENCES currency(code) DEFAULT 'USD',
  owner       text,
  cust_ref    text
);

CREATE TABLE sales_order_line (
  id         serial PRIMARY KEY,
  so_no      text NOT NULL REFERENCES sales_order(no) ON DELETE CASCADE,
  line_no    integer,
  sku        text NOT NULL REFERENCES item(sku),
  qty        numeric(12,2) NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  disc_pct   numeric(5,2) NOT NULL DEFAULT 0
);

CREATE TABLE delivery (
  no        text PRIMARY KEY,
  so_no     text NOT NULL REFERENCES sales_order(no),
  ship_date date,
  warehouse text,
  carrier   text,
  tracking  text,
  status    text NOT NULL CHECK (status IN ('Picked','Packed','In transit','Delivered','Cancelled'))
);

CREATE TABLE delivery_line (
  id        serial PRIMARY KEY,
  do_no     text NOT NULL REFERENCES delivery(no) ON DELETE CASCADE,
  sku       text NOT NULL REFERENCES item(sku),
  ordered   numeric(12,2) NOT NULL,
  delivered numeric(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE sales_invoice (
  no           text PRIMARY KEY,
  so_no        text REFERENCES sales_order(no),
  do_no        text REFERENCES delivery(no),
  customer_id  text NOT NULL REFERENCES customer(id),
  invoice_date date,
  due_date     date,
  tax_code     text REFERENCES tax_code(code) DEFAULT 'SR',
  shipping     numeric(12,2) DEFAULT 0,
  status       text NOT NULL CHECK (status IN ('Draft','Posted','Partially Paid','Paid','Overdue','Voided'))
);

CREATE TABLE invoice_line (
  id         serial PRIMARY KEY,
  inv_no     text NOT NULL REFERENCES sales_invoice(no) ON DELETE CASCADE,
  sku        text NOT NULL REFERENCES item(sku),
  qty        numeric(12,2) NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  disc_pct   numeric(5,2) NOT NULL DEFAULT 0
);

CREATE TABLE invoice_payment (
  id        serial PRIMARY KEY,
  inv_no    text NOT NULL REFERENCES sales_invoice(no) ON DELETE CASCADE,
  pay_date  date,
  method    text,
  amount    numeric(14,2) NOT NULL
);

-- ---------- procure to pay ----------
CREATE TABLE purchase_order (
  no          text PRIMARY KEY,
  supplier_id text NOT NULL REFERENCES supplier(id),
  order_date  date,
  expected    date,
  status      text NOT NULL CHECK (status IN ('Draft','Pending Approval','Approved','Partially Completed','Completed','Cancelled')),
  buyer       text,
  budget      numeric(14,2),
  currency    text REFERENCES currency(code) DEFAULT 'USD'
);

CREATE TABLE po_line (
  id         serial PRIMARY KEY,
  po_no      text NOT NULL REFERENCES purchase_order(no) ON DELETE CASCADE,
  sku        text NOT NULL REFERENCES item(sku),
  qty        numeric(12,2) NOT NULL,
  unit_price numeric(12,2) NOT NULL
);

CREATE TABLE goods_receipt (
  no           text PRIMARY KEY,
  po_no        text NOT NULL REFERENCES purchase_order(no),
  supplier_id  text NOT NULL REFERENCES supplier(id),
  receipt_date date,
  warehouse    text,
  status       text NOT NULL CHECK (status IN ('Draft','Received','QC hold','Putaway'))
);

CREATE TABLE grn_line (
  id       serial PRIMARY KEY,
  grn_no   text NOT NULL REFERENCES goods_receipt(no) ON DELETE CASCADE,
  sku      text NOT NULL REFERENCES item(sku),
  ordered  numeric(12,2) NOT NULL,
  received numeric(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE supplier_invoice (
  no           text PRIMARY KEY,
  po_no        text REFERENCES purchase_order(no),
  grn_no       text REFERENCES goods_receipt(no),
  supplier_id  text NOT NULL REFERENCES supplier(id),
  invoice_date date,
  due_date     date,
  status       text NOT NULL CHECK (status IN ('Draft','Pending Approval','Matched','Posted','Paid'))
);

-- ---------- finance ----------
CREATE TABLE journal_entry (
  no         text PRIMARY KEY,
  entry_date date,
  period     text,
  memo       text,
  source     text,
  status     text NOT NULL CHECK (status IN ('Draft','Submitted','Posted','Voided'))
);

CREATE TABLE journal_line (
  id           serial PRIMARY KEY,
  je_no        text NOT NULL REFERENCES journal_entry(no) ON DELETE CASCADE,
  account_code text NOT NULL REFERENCES gl_account(code),
  dr           numeric(14,2) NOT NULL DEFAULT 0,
  cr           numeric(14,2) NOT NULL DEFAULT 0,
  dimension    text
);

-- ---------- projects & payroll ----------
CREATE TABLE project (
  no             text PRIMARY KEY,
  name           text NOT NULL,
  customer_id    text REFERENCES customer(id),
  project_type   text CHECK (project_type IN ('Customer','Internal')),
  pm             text,
  contract_value numeric(14,2),
  cost_to_date   numeric(14,2) DEFAULT 0,
  pct_complete   integer DEFAULT 0,
  status         text,
  start_date     date,
  due_date       date
);

CREATE TABLE payroll_run (
  period   text PRIMARY KEY,
  pay_date date,
  status   text NOT NULL CHECK (status IN ('Draft','Pending Approval','Posted'))
);

CREATE TABLE payslip (
  id          serial PRIMARY KEY,
  run_period  text NOT NULL REFERENCES payroll_run(period) ON DELETE CASCADE,
  employee_id text NOT NULL REFERENCES employee(id),
  gross       numeric(12,2) NOT NULL,
  epf         numeric(12,2) NOT NULL DEFAULT 0,
  tax         numeric(12,2) NOT NULL DEFAULT 0,
  net         numeric(12,2) GENERATED ALWAYS AS (gross - epf - tax) STORED
);

-- ---------- indexes ----------
CREATE INDEX idx_so_line_so   ON sales_order_line(so_no);
CREATE INDEX idx_inv_line_inv ON invoice_line(inv_no);
CREATE INDEX idx_po_line_po   ON po_line(po_no);
CREATE INDEX idx_je_line_je   ON journal_line(je_no);
CREATE INDEX idx_so_customer  ON sales_order(customer_id);
CREATE INDEX idx_inv_customer ON sales_invoice(customer_id);

-- ============================================================
-- reporting views (used as-is by the BI / Finance screens)
-- ============================================================

-- Sales invoice totals (line subtotal + tax + shipping, paid, balance)
CREATE VIEW v_invoice_totals AS
SELECT i.no,
       i.customer_id,
       i.status,
       i.due_date,
       round(sub.subtotal, 2)                                   AS subtotal,
       round(sub.subtotal * t.rate / 100, 2)                    AS tax,
       i.shipping,
       round(sub.subtotal + sub.subtotal * t.rate / 100 + i.shipping, 2) AS total,
       coalesce(pay.paid, 0)                                    AS paid,
       round(sub.subtotal + sub.subtotal * t.rate / 100 + i.shipping - coalesce(pay.paid,0), 2) AS balance
FROM sales_invoice i
JOIN tax_code t ON t.code = i.tax_code
JOIN (
  SELECT inv_no, sum(qty * unit_price * (1 - disc_pct/100)) AS subtotal
  FROM invoice_line GROUP BY inv_no
) sub ON sub.inv_no = i.no
LEFT JOIN (
  SELECT inv_no, sum(amount) AS paid FROM invoice_payment GROUP BY inv_no
) pay ON pay.inv_no = i.no;

-- AR aging by customer (current vs 1-30 / 31-60 / 61-90 / 90+)
CREATE VIEW v_ar_aging AS
SELECT c.id AS customer_id,
       c.name,
       sum(CASE WHEN v.due_date >= CURRENT_DATE THEN v.balance ELSE 0 END) AS not_due,
       sum(CASE WHEN CURRENT_DATE - v.due_date BETWEEN 1 AND 30  THEN v.balance ELSE 0 END) AS d1_30,
       sum(CASE WHEN CURRENT_DATE - v.due_date BETWEEN 31 AND 60 THEN v.balance ELSE 0 END) AS d31_60,
       sum(CASE WHEN CURRENT_DATE - v.due_date BETWEEN 61 AND 90 THEN v.balance ELSE 0 END) AS d61_90,
       sum(CASE WHEN CURRENT_DATE - v.due_date > 90 THEN v.balance ELSE 0 END) AS d90_plus,
       sum(v.balance) AS total_open
FROM v_invoice_totals v
JOIN customer c ON c.id = v.customer_id
WHERE v.balance > 0
GROUP BY c.id, c.name;

-- Trial balance (net movement per GL account from posted journals)
CREATE VIEW v_trial_balance AS
SELECT a.code, a.name, a.type,
       sum(l.dr) AS total_dr,
       sum(l.cr) AS total_cr,
       sum(l.dr) - sum(l.cr) AS balance
FROM gl_account a
LEFT JOIN journal_line l ON l.account_code = a.code
LEFT JOIN journal_entry j ON j.no = l.je_no AND j.status = 'Posted'
GROUP BY a.code, a.name, a.type;

-- Order-to-cash trace: one row per sales order with its delivery & invoice
CREATE VIEW v_order_to_cash AS
SELECT so.no AS sales_order, so.status AS so_status,
       d.no  AS delivery, d.status AS do_status,
       i.no  AS invoice, i.status AS inv_status,
       c.name AS customer
FROM sales_order so
JOIN customer c ON c.id = so.customer_id
LEFT JOIN delivery d ON d.so_no = so.no
LEFT JOIN sales_invoice i ON i.so_no = so.no;

-- ============================================================
-- extended domain tables (admin, inventory, mfg, quality,
-- service, fixed assets, CRM) — complete the ERP footprint
-- ============================================================

CREATE TABLE app_user (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  email       text UNIQUE NOT NULL,
  role        text NOT NULL CHECK (role IN ('Admin','Finance User','Sales User','Purchase User','Warehouse User','Manager','Approver','Auditor')),
  status      text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Invited','Disabled')),
  mfa         boolean NOT NULL DEFAULT false,
  last_active text,
  employee_id text REFERENCES employee(id)
);

CREATE TABLE audit_log (
  id       serial PRIMARY KEY,
  ts       timestamptz NOT NULL DEFAULT now(),
  app_user text,
  action   text NOT NULL,
  object   text,
  kind     text CHECK (kind IN ('create','edit','post','approval','permission','export','security','config','system')),
  ip       text,
  success  boolean NOT NULL DEFAULT true
);

CREATE TABLE stock_movement (
  id        serial PRIMARY KEY,
  sku       text NOT NULL REFERENCES item(sku),
  move_date date NOT NULL,
  move_type text NOT NULL CHECK (move_type IN ('Goods Receipt','Goods Issue','Transfer In','Transfer Out','Adjustment')),
  ref_doc   text,
  qty       numeric(12,2) NOT NULL,         -- signed: + receipt, - issue
  balance   numeric(12,2),
  warehouse text DEFAULT 'KL-Main'
);

CREATE TABLE work_order (
  no         text PRIMARY KEY,
  sku        text NOT NULL REFERENCES item(sku),   -- finished good
  qty        numeric(12,2) NOT NULL,
  status     text NOT NULL CHECK (status IN ('Planned','Released','In Progress','On Hold','Completed','Closed')),
  start_date date,
  due_date   date,
  warehouse  text DEFAULT 'KL-Main',
  so_no      text REFERENCES sales_order(no)
);

CREATE TABLE qc_inspection (
  no           text PRIMARY KEY,
  ref_doc      text,                               -- GRN / work order
  sku          text REFERENCES item(sku),
  kind         text CHECK (kind IN ('Incoming','In-process','Final')),
  status       text NOT NULL CHECK (status IN ('Scheduled','In Inspection','Pass','Fail','Quarantine','Concession')),
  inspected_by text,
  inspect_date date
);

CREATE TABLE service_ticket (
  no          text PRIMARY KEY,
  customer_id text REFERENCES customer(id),
  subject     text NOT NULL,
  priority    text CHECK (priority IN ('Low','Medium','High','Critical')),
  status      text NOT NULL CHECK (status IN ('Open','In Progress','Scheduled','Resolved','Closed')),
  opened      date,
  technician  text
);

CREATE TABLE fixed_asset (
  id        text PRIMARY KEY,
  name      text NOT NULL,
  category  text,
  acquired  date,
  cost      numeric(14,2) NOT NULL,
  accum_dep numeric(14,2) NOT NULL DEFAULT 0,
  status    text NOT NULL DEFAULT 'In use' CHECK (status IN ('In use','Under maintenance','Idle','Disposed')),
  nbv       numeric(14,2) GENERATED ALWAYS AS (cost - accum_dep) STORED
);

CREATE TABLE opportunity (
  no          text PRIMARY KEY,
  customer_id text REFERENCES customer(id),
  title       text NOT NULL,
  stage       text NOT NULL CHECK (stage IN ('Lead','Qualified','Proposal','Negotiation','Won','Lost')),
  value       numeric(14,2),
  probability integer CHECK (probability BETWEEN 0 AND 100),
  owner       text,
  close_date  date
);

CREATE INDEX idx_stock_sku    ON stock_movement(sku);
CREATE INDEX idx_audit_ts     ON audit_log(ts);
CREATE INDEX idx_opp_customer ON opportunity(customer_id);

-- ============================================================
-- platform multi-tenancy (Super Admin → Master Control)
-- A master account is a tenant; it owns company legal entities
-- and users. The Master Control screen does full CRUD on these.
-- ============================================================

CREATE TABLE master_account (
  id         text PRIMARY KEY,                       -- MST-####
  name       text NOT NULL,
  plan       text NOT NULL DEFAULT 'Starter' CHECK (plan IN ('Starter','Business','Enterprise')),
  region     text,
  status     text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Suspended')),
  owner      text,
  modules    integer NOT NULL DEFAULT 0,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE master_company (
  id         text PRIMARY KEY,                       -- CMP-####
  master_id  text NOT NULL REFERENCES master_account(id) ON DELETE CASCADE,
  name       text NOT NULL,
  cur        text NOT NULL DEFAULT 'USD',
  branches   integer NOT NULL DEFAULT 1,
  status     text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Suspended')),
  is_current boolean NOT NULL DEFAULT false
);

CREATE TABLE master_user (
  id          text PRIMARY KEY,                      -- USR-####
  master_id   text NOT NULL REFERENCES master_account(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text,
  role        text,
  access      text,
  status      text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Suspended')),
  last_active text DEFAULT 'Just now'
);

CREATE INDEX idx_master_company_m ON master_company(master_id);
CREATE INDEX idx_master_user_m    ON master_user(master_id);
