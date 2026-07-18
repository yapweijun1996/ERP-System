-- Canonical manufacturing fixture for the browser PGlite demo.
-- Uses only fictional products already present in the shared seed and is safe
-- to replay against an upgraded persistent IndexedDB database.
insert into work_center
  (master_fn, company_fn, code, name, capacity_hours_per_day)
select 'M1', 'C-SG', 'WC-ASSEMBLY', 'Demo Assembly Cell', 8
where not exists (
  select 1 from work_center
  where master_fn='M1' and company_fn='C-SG' and code='WC-ASSEMBLY'
);

insert into manufacturing_bom
  (master_fn, company_fn, code, product_id, name, status)
select 'M1', 'C-SG', 'BOM-SG-WIDGET', p.id, 'Widget assembly BOM', 'active'
from product p
where p.master_fn='M1' and p.company_fn='C-SG' and p.sku='SG-WIDGET'
  and not exists (
    select 1 from manufacturing_bom b
    where b.master_fn='M1' and b.company_fn='C-SG' and b.code='BOM-SG-WIDGET'
  );

insert into bom_version
  (master_fn, company_fn, bom_id, revision, status, effective_from, output_qty, uom)
select 'M1', 'C-SG', b.id, 'A', 'active', '2026-07-01', 1, 'unit'
from manufacturing_bom b
where b.master_fn='M1' and b.company_fn='C-SG' and b.code='BOM-SG-WIDGET'
  and not exists (
    select 1 from bom_version v
    where v.master_fn='M1' and v.company_fn='C-SG'
      and v.bom_id=b.id and v.revision='A'
  );

insert into bom_component
  (master_fn, company_fn, bom_version_id, line_no, product_id, qty_per, scrap_pct)
select 'M1', 'C-SG', v.id, 1, p.id, 2, 0
from bom_version v
join manufacturing_bom b on b.id=v.bom_id
join product p on p.master_fn='M1' and p.company_fn='C-SG' and p.sku='SG-GADGET'
where v.master_fn='M1' and v.company_fn='C-SG'
  and b.code='BOM-SG-WIDGET' and v.revision='A'
  and not exists (
    select 1 from bom_component c
    where c.master_fn='M1' and c.company_fn='C-SG'
      and c.bom_version_id=v.id and c.line_no=1
  );

insert into manufacturing_routing
  (master_fn, company_fn, code, product_id, name, status)
select 'M1', 'C-SG', 'RT-SG-WIDGET', p.id, 'Widget assembly routing', 'active'
from product p
where p.master_fn='M1' and p.company_fn='C-SG' and p.sku='SG-WIDGET'
  and not exists (
    select 1 from manufacturing_routing r
    where r.master_fn='M1' and r.company_fn='C-SG' and r.code='RT-SG-WIDGET'
  );

insert into routing_operation
  (master_fn, company_fn, routing_id, sequence, work_center_id, name, setup_hours, run_hours_per_unit)
select 'M1', 'C-SG', r.id, 10, wc.id, 'Assemble and inspect', 0.5, 0.25
from manufacturing_routing r
join work_center wc on wc.master_fn='M1' and wc.company_fn='C-SG' and wc.code='WC-ASSEMBLY'
where r.master_fn='M1' and r.company_fn='C-SG' and r.code='RT-SG-WIDGET'
  and not exists (
    select 1 from routing_operation o
    where o.master_fn='M1' and o.company_fn='C-SG'
      and o.routing_id=r.id and o.sequence=10
  );

insert into work_order
  (master_fn, company_fn, doc_no, status, product_id, bom_version_id,
   routing_id, warehouse_id, planned_qty, completed_qty, start_date,
   due_date, priority, demand_source, released_at)
select 'M1', 'C-SG', 'WO-1', 'released', p.id, v.id,
       r.id, w.id, 5, 0, '2026-07-19', '2026-07-22',
       'high', 'Demo replenishment', now()
from product p
join manufacturing_bom b on b.master_fn='M1' and b.company_fn='C-SG'
  and b.product_id=p.id and b.code='BOM-SG-WIDGET'
join bom_version v on v.master_fn='M1' and v.company_fn='C-SG'
  and v.bom_id=b.id and v.revision='A'
join manufacturing_routing r on r.master_fn='M1' and r.company_fn='C-SG'
  and r.product_id=p.id and r.code='RT-SG-WIDGET'
join warehouse w on w.master_fn='M1' and w.company_fn='C-SG' and w.code='WH-SALES'
where p.master_fn='M1' and p.company_fn='C-SG' and p.sku='SG-WIDGET'
  and not exists (
    select 1 from work_order wo
    where wo.master_fn='M1' and wo.company_fn='C-SG' and wo.doc_no='WO-1'
  );

insert into work_order_material
  (master_fn, company_fn, work_order_id, line_no, product_id,
   required_qty, issued_qty, unit_cost)
select 'M1', 'C-SG', wo.id, 1, p.id, 10, 0, p.standard_cost
from work_order wo
join product p on p.master_fn='M1' and p.company_fn='C-SG' and p.sku='SG-GADGET'
where wo.master_fn='M1' and wo.company_fn='C-SG' and wo.doc_no='WO-1'
  and not exists (
    select 1 from work_order_material m
    where m.master_fn='M1' and m.company_fn='C-SG'
      and m.work_order_id=wo.id and m.line_no=1
  );

insert into work_order_operation
  (master_fn, company_fn, work_order_id, sequence, work_center_id,
   name, planned_hours, actual_hours, status)
select 'M1', 'C-SG', wo.id, 10, wc.id,
       'Assemble and inspect', 1.75, 0, 'ready'
from work_order wo
join work_center wc on wc.master_fn='M1' and wc.company_fn='C-SG' and wc.code='WC-ASSEMBLY'
where wo.master_fn='M1' and wo.company_fn='C-SG' and wo.doc_no='WO-1'
  and not exists (
    select 1 from work_order_operation o
    where o.master_fn='M1' and o.company_fn='C-SG'
      and o.work_order_id=wo.id and o.sequence=10
  );
