-- Canonical enquiry/quotation fixture for browser PGlite. Fictional and
-- idempotent so persistent IndexedDB databases can be topped up safely.
insert into sales_enquiry
  (master_fn, company_fn, doc_no, status, version, customer_id, subject,
   channel, estimated_value, currency, owner_name, enquiry_date)
select 'M1', 'C-SG', 'ENQ-DEMO-1', 'new', 1, c.id,
       'Demo request for widget pricing and delivery',
       'email', 1200, 'SGD', 'Demo Sales', '2026-07-19'
from customer c
where c.master_fn='M1' and c.company_fn='C-SG' and c.code='CUST1'
  and not exists (
    select 1 from sales_enquiry e
    where e.master_fn='M1' and e.company_fn='C-SG' and e.doc_no='ENQ-DEMO-1'
  );

insert into sales_quotation
  (master_fn, company_fn, doc_no, status, version, customer_id,
   quote_date, valid_until, currency, probability,
   net_amount, tax_amount, total_amount)
select 'M1', 'C-SG', 'Q-DEMO-1', 'sent', 2, c.id,
       '2026-07-19', '2026-08-19', 'SGD', 75,
       100, 9, 109
from customer c
where c.master_fn='M1' and c.company_fn='C-SG' and c.code='CUST1'
  and not exists (
    select 1 from sales_quotation q
    where q.master_fn='M1' and q.company_fn='C-SG' and q.doc_no='Q-DEMO-1'
  );

insert into sales_quotation_line
  (master_fn, company_fn, quotation_id, line_no, line_type, product_id, description, uom,
   qty, unit_price, net_amount, tax_code, tax_rate, tax_amount)
select 'M1', 'C-SG', q.id, 1, 'stock', p.id, p.name, p.uom,
       10, 10, 100, 'SR', 9, 9
from sales_quotation q
join product p on p.master_fn=q.master_fn and p.company_fn=q.company_fn
  and p.sku='SG-WIDGET'
where q.master_fn='M1' and q.company_fn='C-SG' and q.doc_no='Q-DEMO-1'
  and not exists (
    select 1 from sales_quotation_line l
    where l.master_fn='M1' and l.company_fn='C-SG'
      and l.quotation_id=q.id and l.line_no=1
  );
