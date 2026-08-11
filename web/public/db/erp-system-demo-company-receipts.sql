-- Demo compatibility top-up for TASK-179.
--
-- The flat migration bundle is applied before the deterministic showcase pack
-- creates its role templates. Re-apply the permission backfill afterwards so a
-- fresh browser database and an upgraded browser database expose the same
-- Company Receipt Register contract. The inserts are intentionally idempotent.

INSERT INTO role_permission (master_fn, role_id, permission_key, allowed)
SELECT
  role.master_fn,
  role.role_id,
  CASE
    WHEN role.source_template_key IN ('company_owner', 'finance_preparer', 'finance_checker')
      OR role.name IN ('Company Owner', 'Finance Preparer', 'Finance Checker', 'Receipt Manager')
      THEN 'expenses.company_receipts.read_company'
    ELSE 'expenses.company_receipts.read_own'
  END,
  true
FROM role
WHERE role.source_template_key IN (
    'company_owner', 'employee', 'manager', 'finance_preparer', 'finance_checker'
  )
  OR role.name IN (
    'Company Owner', 'Employee', 'Manager', 'Finance Preparer', 'Finance Checker', 'Receipt Manager'
  )
ON CONFLICT (role_id, permission_key) DO UPDATE SET
  allowed = EXCLUDED.allowed,
  updated_at = now();

INSERT INTO role_permission (master_fn, role_id, permission_key, allowed)
SELECT role.master_fn, role.role_id, 'finance.read', true
FROM role
WHERE role.source_template_key = 'receipt_manager'
   OR role.name = 'Receipt Manager'
ON CONFLICT (role_id, permission_key) DO UPDATE SET
  allowed = EXCLUDED.allowed,
  updated_at = now();
