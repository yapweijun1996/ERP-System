INSERT INTO sales_debit_note (
  master_fn, company_fn, doc_no, invoice_id, status, note_date, currency,
  reason, net_amount, tax_code, tax_rate, tax_amount, total_amount
)
SELECT 'M1', 'C-SG', 'DN-DEMO-1', inv.id, 'draft', DATE '2026-07-19', inv.currency,
       'Fictional expedited handling charge', 10.00, 'SR', 9.000, 0.90, 10.90
  FROM invoice inv
 WHERE inv.master_fn = 'M1' AND inv.company_fn = 'C-SG'
 ORDER BY inv.id
 LIMIT 1
ON CONFLICT (master_fn, company_fn, doc_no) DO NOTHING;
