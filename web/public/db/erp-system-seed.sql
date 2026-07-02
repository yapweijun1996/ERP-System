-- ============================================================
-- ERP-System canonical demo seed (SQL form of src/data/seed.ts)
-- Runs in PGlite against web/public/db/erp-system-schema.sql
-- (a byte-for-byte copy of drizzle/0000_init.sql).
-- Keep in sync with src/data/seed.ts — same masters, companies,
-- products, tax rules, customer and chart of accounts.
-- Adds the sales fixture from src/demo.ts runSalesScenario:
-- warehouse WH-SALES with 100 on hand for both SG products.
-- ============================================================

INSERT INTO master (master_fn, name) VALUES ('M1', 'Acme Group');

INSERT INTO currency (code, name, symbol) VALUES
  ('SGD', 'Singapore Dollar', 'S$'),
  ('MYR', 'Malaysian Ringgit', 'RM');

INSERT INTO company (company_fn, master_fn, name, country, currency, tax_regime, locale) VALUES
  ('C-SG', 'M1', 'Acme Singapore', 'SG', 'SGD', 'GST', 'en'),
  ('C-MY', 'M1', 'Acme Malaysia', 'MY', 'MYR', 'SST', 'ms');

INSERT INTO app_user (master_fn, email, full_name, language) VALUES
  ('M1', 'admin@acme.co', 'Admin', 'zh');

INSERT INTO product (master_fn, company_fn, sku, name, uom) VALUES
  ('M1', 'C-SG', 'SG-WIDGET', 'Widget (SG)', 'unit'),
  ('M1', 'C-SG', 'SG-GADGET', 'Gadget (SG)', 'box'),
  ('M1', 'C-MY', 'MY-WIDGET', 'Widget (MY)', 'unit');

-- SG GST standard-rated: 8% from 2023, 9% from 2024 (effective-dated). MY SST 8%.
INSERT INTO tax_rule (master_fn, company_fn, tax_regime, tax_code, rate, valid_from, valid_to) VALUES
  ('M1', 'C-SG', 'GST', 'SR', 8.000, '2023-01-01', '2024-01-01'),
  ('M1', 'C-SG', 'GST', 'SR', 9.000, '2024-01-01', NULL),
  ('M1', 'C-MY', 'SST', 'SV', 8.000, '2025-07-01', NULL);

INSERT INTO customer (master_fn, company_fn, code, name) VALUES
  ('M1', 'C-SG', 'CUST1', 'Beta Pte Ltd');

-- Minimal chart of accounts for the SG company (used by sales-order posting).
INSERT INTO account (master_fn, company_fn, code, name, type) VALUES
  ('M1', 'C-SG', '1100', 'Accounts Receivable', 'asset'),
  ('M1', 'C-SG', '4000', 'Revenue', 'income'),
  ('M1', 'C-SG', '2200', 'GST Output Tax', 'liability');

-- Sales fixture (src/demo.ts runSalesScenario): warehouse + opening stock 100/100.
INSERT INTO warehouse (master_fn, company_fn, code, name) VALUES
  ('M1', 'C-SG', 'WH-SALES', 'Sales Warehouse');

INSERT INTO stock_level (master_fn, company_fn, product_id, warehouse_id, qty)
SELECT 'M1', 'C-SG', p.id, w.id, 100
FROM product p
JOIN warehouse w ON w.master_fn = 'M1' AND w.company_fn = 'C-SG' AND w.code = 'WH-SALES'
WHERE p.master_fn = 'M1' AND p.company_fn = 'C-SG' AND p.sku IN ('SG-WIDGET', 'SG-GADGET');
