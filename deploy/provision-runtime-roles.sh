#!/usr/bin/env bash
# Provision explicit non-superuser/non-BYPASSRLS API and worker roles on an
# already-provisioned PostgreSQL database. Run this as the migration/database
# owner before starting the application services.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${DATABASE_ADMIN_URL:?DATABASE_ADMIN_URL is required and must use a database-admin/migration owner connection}"
: "${DB_API_PASSWORD:?DB_API_PASSWORD is required}"
: "${DB_WORKER_PASSWORD:?DB_WORKER_PASSWORD is required}"

export DB_API_USER="${DB_API_USER:-erp_api}"
export DB_WORKER_USER="${DB_WORKER_USER:-erp_worker}"

psql "${DATABASE_ADMIN_URL}" \
  --no-password \
  --set ON_ERROR_STOP=1 \
  --file deploy/sql/runtime-roles.sql

echo "Runtime database roles provisioned: API=${DB_API_USER}, worker=${DB_WORKER_USER}."
