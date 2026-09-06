#!/usr/bin/env bash
# Verify the runtime role boundary without printing credentials.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${DATABASE_ADMIN_URL:?DATABASE_ADMIN_URL is required}"
api_user="${DB_API_USER:-erp_api}"
worker_user="${DB_WORKER_USER:-erp_worker}"

if [[ ! "${api_user}" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]; then
  echo "DB_API_USER is not a safe PostgreSQL role name." >&2
  exit 1
fi
if [[ ! "${worker_user}" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]; then
  echo "DB_WORKER_USER is not a safe PostgreSQL role name." >&2
  exit 1
fi
if [ "${api_user}" = "${worker_user}" ]; then
  echo "DB_API_USER and DB_WORKER_USER must be distinct." >&2
  exit 1
fi

result="$(psql "${DATABASE_ADMIN_URL}" --no-password --set ON_ERROR_STOP=1 --tuples-only --no-align \
  --command "select rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole from pg_roles where rolname in ('${api_user}', '${worker_user}') order by rolname")"

printf '%s\n' "${result}"

expected="$(printf '%s\n' \
  "${api_user}|f|f|f|f" \
  "${worker_user}|f|f|f|f" | sort)"
actual="$(printf '%s\n' "${result}" | sed '/^$/d' | sort)"
if [ "${actual}" != "${expected}" ]; then
  echo "Runtime role verification failed: expected both roles to be NOSUPERUSER, NOBYPASSRLS, NOCREATEDB and NOCREATEROLE." >&2
  exit 1
fi

echo "Runtime role verification passed."
