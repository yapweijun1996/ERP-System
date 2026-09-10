-- Account creation is final; remove obsolete first-login activation state.
-- Passwords, membership, roles and the independent disabled/offboarded controls stay intact.
WITH pending AS (
  SELECT user_id, master_fn, account_state, password_change_required
  FROM app_user
  WHERE account_state <> 'offboarded'
    AND (account_state = 'preactivated' OR password_change_required = true
      OR initial_password_expires_at IS NOT NULL)
), updated AS (
  UPDATE app_user AS u
  SET account_state = CASE WHEN u.account_state = 'preactivated' THEN 'active' ELSE u.account_state END,
      password_change_required = false,
      initial_password_expires_at = NULL,
      activated_at = COALESCE(u.activated_at, u.created_at),
      updated_at = now()
  FROM pending AS p
  WHERE u.user_id = p.user_id
  RETURNING u.user_id, u.master_fn, u.account_state,
    p.account_state AS previous_state, p.password_change_required AS previous_requirement
)
INSERT INTO audit_log (master_fn, request_id, entity, entity_id, action, "before", "after")
SELECT master_fn, 'migration-0111-immediate-account-access', 'app_user', user_id::text,
  'first_login_activation_removed',
  jsonb_build_object('accountState', previous_state, 'passwordChangeRequired', previous_requirement),
  jsonb_build_object('accountState', account_state, 'passwordChangeRequired', false)
FROM updated;
