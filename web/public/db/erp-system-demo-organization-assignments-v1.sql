-- INITIAL FRESH DEMO BOOT ONLY. Never execute against retained IndexedDB data.
-- All employees here were just created by the canonical seed/showcase in this boot.
-- Labels, manager links, users, roles and permissions remain unchanged.
UPDATE employee AS staff
SET business_unit_id=unit.id, position_id=position.id, organization_version=1
FROM hr_business_unit AS unit, hr_position AS position
WHERE staff.master_fn='M1' AND staff.company_fn='C-SG'
  AND staff.is_active=true AND staff.organization_version=0
  AND staff.business_unit_id IS NULL AND staff.position_id IS NULL
  AND unit.master_fn=staff.master_fn AND unit.company_fn=staff.company_fn AND unit.is_active=true
  AND position.master_fn=staff.master_fn AND position.company_fn=staff.company_fn AND position.is_active=true
  AND unit.code=CASE
    WHEN staff.department='Sales' THEN 'DEMO-COMMERCIAL'
    WHEN staff.department IN ('Purchasing','Warehouse','Production','Service') THEN 'DEMO-OPERATIONS'
    ELSE 'DEMO-CORPORATE' END
  AND position.code=CASE
    WHEN lower(staff.job_title) ~ '(manager|director|head|chief|owner)' THEN 'DEMO-MANAGER'
    WHEN lower(staff.job_title) LIKE '%executive%' THEN 'DEMO-EXECUTIVE'
    WHEN lower(staff.job_title) LIKE '%specialist%' THEN 'DEMO-SPECIALIST'
    WHEN lower(staff.job_title) LIKE '%analyst%' THEN 'DEMO-ANALYST'
    WHEN lower(staff.job_title) LIKE '%coordinator%' THEN 'DEMO-COORDINATOR'
    ELSE 'DEMO-ASSOCIATE' END;
