-- Reconcile legacy employee rows that advertised an annual entitlement but had
-- no immutable balance fact. The selected policy is deterministic: the version
-- covering the employee start date, otherwise the first future version, then
-- the latest historic version. Existing ledger history is never rewritten.
WITH annual_candidates AS (
  SELECT
    employee."id" AS employee_id,
    employee."master_fn",
    employee."company_fn",
    employee."start_date",
    employee."annual_leave_days",
    leave_type."id" AS leave_type_id,
    policy."id" AS policy_version_id,
    policy."effective_from",
    policy."effective_to",
    row_number() OVER (
      PARTITION BY employee."id", leave_type."id"
      ORDER BY
        CASE
          WHEN policy."effective_from" <= employee."start_date"
            AND (policy."effective_to" IS NULL OR policy."effective_to" >= employee."start_date")
            THEN 0
          WHEN policy."effective_from" > employee."start_date" THEN 1
          ELSE 2
        END,
        CASE
          WHEN policy."effective_from" <= employee."start_date"
            AND (policy."effective_to" IS NULL OR policy."effective_to" >= employee."start_date")
            THEN policy."version_no"
        END DESC NULLS LAST,
        CASE WHEN policy."effective_from" > employee."start_date"
          THEN policy."effective_from" END ASC NULLS LAST,
        CASE WHEN policy."effective_to" < employee."start_date"
          THEN policy."effective_to" END DESC NULLS LAST,
        policy."version_no" DESC
    ) AS candidate_rank
  FROM "employee" employee
  JOIN "leave_type" leave_type
    ON leave_type."master_fn" = employee."master_fn"
   AND leave_type."company_fn" = employee."company_fn"
   AND leave_type."code" = 'ANNUAL'
   AND leave_type."paid" = true
   AND leave_type."is_active" = true
  JOIN "leave_policy_version" policy
    ON policy."master_fn" = employee."master_fn"
   AND policy."company_fn" = employee."company_fn"
   AND policy."leave_type_id" = leave_type."id"
   AND policy."status" = 'confirmed'
   AND policy."eligible_employment_types" @> jsonb_build_array(employee."employment_type")
  WHERE employee."annual_leave_days" > 0
)
INSERT INTO "leave_balance_entry" (
  "master_fn", "company_fn", "employee_id", "leave_type_id", "policy_version_id",
  "entry_type", "entry_key", "balance_delta", "reserved_delta", "effective_date",
  "source_type", "source_id", "note", "created_by_user_id"
)
SELECT
  candidate."master_fn",
  candidate."company_fn",
  candidate."employee_id",
  candidate."leave_type_id",
  candidate."policy_version_id",
  'grant',
  'employee:' || candidate."employee_id" || ':annual-opening',
  candidate."annual_leave_days",
  0,
  CASE
    WHEN candidate."effective_from" <= candidate."start_date"
      AND (candidate."effective_to" IS NULL OR candidate."effective_to" >= candidate."start_date")
      THEN candidate."start_date"
    WHEN candidate."effective_from" > candidate."start_date"
      THEN candidate."effective_from"
    ELSE coalesce(candidate."effective_to", candidate."effective_from")
  END,
  'employee_opening',
  candidate."employee_id"::text,
  'Opening annual leave entitlement',
  NULL
FROM annual_candidates candidate
WHERE candidate.candidate_rank = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "leave_balance_entry" existing
    WHERE existing."master_fn" = candidate."master_fn"
      AND existing."company_fn" = candidate."company_fn"
      AND existing."employee_id" = candidate."employee_id"
      AND existing."leave_type_id" = candidate."leave_type_id"
  )
ON CONFLICT DO NOTHING;
