INSERT INTO sales_credit_profile (
  master_fn, company_fn, customer_id, currency, credit_limit, status, version
)
SELECT 'M1', 'C-SG', c.id, 'SGD', 5000.00, 'open', 1
  FROM customer c
 WHERE c.master_fn = 'M1' AND c.company_fn = 'C-SG'
 ORDER BY c.id
 LIMIT 1
ON CONFLICT (master_fn, company_fn, customer_id) DO NOTHING;
