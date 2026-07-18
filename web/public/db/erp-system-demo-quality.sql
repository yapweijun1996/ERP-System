-- Canonical quality fixture for the browser PGlite demo. All rows are
-- fictional, tenant scoped and guarded for safe replay on every boot.
insert into quality_inspection_plan
  (master_fn, company_fn, code, name, inspection_type, product_id, sample_size, is_active)
select 'M1', 'C-SG', 'QIP-DEMO', 'Finished goods release inspection',
       'final', p.id, 2, true
from product p
where p.master_fn='M1' and p.company_fn='C-SG' and p.sku='SG-WIDGET'
  and not exists (
    select 1 from quality_inspection_plan q
    where q.master_fn='M1' and q.company_fn='C-SG' and q.code='QIP-DEMO'
  );

insert into quality_inspection_plan_item
  (master_fn, company_fn, plan_id, sequence, characteristic, specification, method)
select 'M1', 'C-SG', p.id, v.sequence, v.characteristic, v.specification, v.method
from quality_inspection_plan p
cross join (values
  (10, 'Dimensions', 'Within released drawing tolerance', 'Caliper'),
  (20, 'Appearance', 'No visible damage', 'Visual')
) as v(sequence, characteristic, specification, method)
where p.master_fn='M1' and p.company_fn='C-SG' and p.code='QIP-DEMO'
  and not exists (
    select 1 from quality_inspection_plan_item i
    where i.master_fn='M1' and i.company_fn='C-SG'
      and i.plan_id=p.id and i.sequence=v.sequence
  );

insert into quality_inspection
  (master_fn, company_fn, doc_no, status, version, inspection_type,
   plan_id, product_id, source_type, source_ref, lot_qty, sample_qty,
   inspector_name, inspection_date, completed_at)
select 'M1', 'C-SG', 'QI-DEMO-1', 'failed', 2, 'final',
       q.id, p.id, 'work_order', 'WO-DEMO-1', 20, 2,
       'Demo QA', '2026-07-19', now()
from quality_inspection_plan q
join product p on p.master_fn=q.master_fn and p.company_fn=q.company_fn
  and p.sku='SG-WIDGET'
where q.master_fn='M1' and q.company_fn='C-SG' and q.code='QIP-DEMO'
  and not exists (
    select 1 from quality_inspection i
    where i.master_fn='M1' and i.company_fn='C-SG' and i.doc_no='QI-DEMO-1'
  );

insert into quality_inspection
  (master_fn, company_fn, doc_no, status, version, inspection_type,
   plan_id, product_id, source_type, source_ref, lot_qty, sample_qty,
   inspector_name, inspection_date)
select 'M1', 'C-SG', 'QI-DEMO-2', 'scheduled', 1, 'final',
       q.id, p.id, 'manual', 'FG release sample', 10, 2,
       'Demo QA', '2026-07-20'
from quality_inspection_plan q
join product p on p.master_fn=q.master_fn and p.company_fn=q.company_fn
  and p.sku='SG-WIDGET'
where q.master_fn='M1' and q.company_fn='C-SG' and q.code='QIP-DEMO'
  and not exists (
    select 1 from quality_inspection i
    where i.master_fn='M1' and i.company_fn='C-SG' and i.doc_no='QI-DEMO-2'
  );

insert into quality_inspection_result
  (master_fn, company_fn, inspection_id, plan_item_id, sequence,
   characteristic, specification, method, measured_value, result, defect_class)
select 'M1', 'C-SG', i.id, pi.id, pi.sequence, pi.characteristic,
       pi.specification, pi.method,
       case when pi.sequence=10 then 'Outside tolerance' else 'Clear' end,
       case when pi.sequence=10 then 'fail' else 'pass' end,
       case when pi.sequence=10 then 'major' else null end
from quality_inspection i
join quality_inspection_plan_item pi
  on pi.master_fn=i.master_fn and pi.company_fn=i.company_fn and pi.plan_id=i.plan_id
where i.master_fn='M1' and i.company_fn='C-SG' and i.doc_no='QI-DEMO-1'
  and not exists (
    select 1 from quality_inspection_result r
    where r.master_fn='M1' and r.company_fn='C-SG'
      and r.inspection_id=i.id and r.sequence=pi.sequence
  );

insert into quality_inspection_result
  (master_fn, company_fn, inspection_id, plan_item_id, sequence,
   characteristic, specification, method)
select 'M1', 'C-SG', i.id, pi.id, pi.sequence, pi.characteristic,
       pi.specification, pi.method
from quality_inspection i
join quality_inspection_plan_item pi
  on pi.master_fn=i.master_fn and pi.company_fn=i.company_fn and pi.plan_id=i.plan_id
where i.master_fn='M1' and i.company_fn='C-SG' and i.doc_no='QI-DEMO-2'
  and not exists (
    select 1 from quality_inspection_result r
    where r.master_fn='M1' and r.company_fn='C-SG'
      and r.inspection_id=i.id and r.sequence=pi.sequence
  );

insert into quality_ncr
  (master_fn, company_fn, doc_no, status, version, inspection_id,
   product_id, severity, affected_qty, defect_description, disposition)
select 'M1', 'C-SG', 'NCR-DEMO-1', 'open', 1, i.id,
       i.product_id, 'major', i.lot_qty,
       'Dimension result exceeded the released tolerance.', 'quarantine'
from quality_inspection i
where i.master_fn='M1' and i.company_fn='C-SG' and i.doc_no='QI-DEMO-1'
  and not exists (
    select 1 from quality_ncr n
    where n.master_fn='M1' and n.company_fn='C-SG' and n.doc_no='NCR-DEMO-1'
  );

insert into quality_corrective_action
  (master_fn, company_fn, ncr_id, sequence, action, owner_name, due_date, status)
select 'M1', 'C-SG', n.id, 1,
       'Verify fixture and review the measurement process.',
       'Demo QA', '2026-07-26', 'open'
from quality_ncr n
where n.master_fn='M1' and n.company_fn='C-SG' and n.doc_no='NCR-DEMO-1'
  and not exists (
    select 1 from quality_corrective_action a
    where a.master_fn='M1' and a.company_fn='C-SG'
      and a.ncr_id=n.id and a.sequence=1
  );
