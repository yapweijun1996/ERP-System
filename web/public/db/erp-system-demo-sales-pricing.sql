WITH picked AS (
  SELECT id FROM product
   WHERE master_fn = 'M1' AND company_fn = 'C-SG'
   ORDER BY id LIMIT 1
), inserted AS (
  INSERT INTO sales_price_list (
    master_fn, company_fn, code, name, basis, currency, status, version,
    is_default, effective_from
  )
  VALUES (
    'M1', 'C-SG', 'PL-DEMO', 'Standard Singapore List', 'standard', 'SGD',
    'active', 2, true, DATE '2026-01-01'
  )
  ON CONFLICT (master_fn, company_fn, code) DO NOTHING
  RETURNING id
)
INSERT INTO sales_price_list_line (
  master_fn, company_fn, price_list_id, line_no, product_id,
  min_qty, unit_price, floor_price
)
SELECT 'M1', 'C-SG', coalesce(
         (SELECT id FROM inserted),
         (SELECT id FROM sales_price_list
           WHERE master_fn = 'M1' AND company_fn = 'C-SG' AND code = 'PL-DEMO')
       ), 1, picked.id, 1, 12.50, 9.00
  FROM picked
ON CONFLICT (master_fn, company_fn, price_list_id, product_id, min_qty) DO NOTHING;

INSERT INTO sales_discount_rule (
  master_fn, company_fn, code, name, rule_type, min_order_amount,
  discount_pct, approval_threshold_pct, effective_from, status, version
)
VALUES (
  'M1', 'C-SG', 'DR-DEMO', 'Standard order discount', 'standard', 1000,
  2.000, 10.000, DATE '2026-01-01', 'active', 2
)
ON CONFLICT (master_fn, company_fn, code) DO NOTHING;
