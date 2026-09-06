-- Provision the database roles used by the running API and workers.
--
-- This file is intentionally executed by a database administrator (or the
-- bundled PostgreSQL bootstrap user), never by the application role. Passwords
-- are read from the process environment with psql's \getenv and are not stored
-- in this repository or passed as SQL literals by the caller.

\set ON_ERROR_STOP on
\getenv runtime_api_user DB_API_USER
\getenv runtime_api_password DB_API_PASSWORD
\getenv runtime_worker_user DB_WORKER_USER
\getenv runtime_worker_password DB_WORKER_PASSWORD

SELECT (
  :'runtime_api_user' ~ '^[a-z_][a-z0-9_]{0,62}$'
  AND :'runtime_worker_user' ~ '^[a-z_][a-z0-9_]{0,62}$'
  AND :'runtime_api_user' <> :'runtime_worker_user'
) AS runtime_role_names_valid \gset

\if :runtime_role_names_valid
\else
  \echo 'DB_API_USER and DB_WORKER_USER must be distinct lowercase PostgreSQL role names.'
  \quit 3
\endif

-- Create or reconcile both roles without granting database ownership, DDL,
-- role-management, or RLS bypass privileges.
SELECT format(
  'DO $runtime_role$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = %L) THEN
       CREATE ROLE %I LOGIN PASSWORD %L;
     ELSE
       ALTER ROLE %I LOGIN PASSWORD %L;
     END IF;
     ALTER ROLE %I WITH NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
   END $runtime_role$;',
  :'runtime_api_user', :'runtime_api_user', :'runtime_api_password',
  :'runtime_api_user', :'runtime_api_password', :'runtime_api_user'
) \gexec

SELECT format(
  'DO $runtime_role$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = %L) THEN
       CREATE ROLE %I LOGIN PASSWORD %L;
     ELSE
       ALTER ROLE %I LOGIN PASSWORD %L;
     END IF;
     ALTER ROLE %I WITH NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
   END $runtime_role$;',
  :'runtime_worker_user', :'runtime_worker_user', :'runtime_worker_password',
  :'runtime_worker_user', :'runtime_worker_password', :'runtime_worker_user'
) \gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'runtime_api_user') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'runtime_worker_user') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'runtime_api_user') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'runtime_worker_user') \gexec

-- The API is allowed to perform application DML, but not DDL, TRUNCATE,
-- trigger creation, references, or role/database administration. FORCE RLS
-- remains the tenant boundary for the tables listed in production-rls.sql.
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', :'runtime_api_user') \gexec
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', :'runtime_api_user') \gexec
SELECT format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM %I', :'runtime_api_user') \gexec
SELECT format('REVOKE CREATE ON SCHEMA public FROM %I', :'runtime_api_user') \gexec

-- Workers read the shared schema and may write their queue/result projections.
-- DELETE is restricted to the cleanup tables used by runMaintenance().
SELECT format('GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO %I', :'runtime_worker_user') \gexec
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', :'runtime_worker_user') \gexec
SELECT format('REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM %I', :'runtime_worker_user') \gexec
SELECT format('GRANT DELETE ON TABLE %I TO %I', c.relname, :'runtime_worker_user')
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname = ANY (ARRAY[
    'api_idempotency', 'auth_rate_limit', 'app_session',
    'user_invitation', 'password_reset_token', 'outbox_event',
    'report_artifact', 'report_job'
  ]) \gexec

-- Future Drizzle tables are covered when migrations run as this same database
-- owner. The explicit grants above make this file safe to rerun after an
-- already-migrated external database.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"runtime_api_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO :"runtime_worker_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"runtime_api_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"runtime_worker_user";

-- Do not let the PUBLIC pseudo-role reintroduce schema creation for runtime
-- users. The migration owner remains able to create objects as the owner.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

SELECT
  :'runtime_api_user' AS api_role,
  :'runtime_worker_user' AS worker_role,
  current_database() AS database_name;
