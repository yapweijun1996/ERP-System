#!/bin/sh
set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

# The official PostgreSQL image runs this before Drizzle migrations on a fresh
# volume. scripts/setup.sh also invokes it after startup so existing volumes
# receive the same role contract.
export DB_API_USER="${DB_API_USER:-erp_api}"
export DB_API_PASSWORD="${DB_API_PASSWORD:-erp_api_dev_password}"
export DB_WORKER_USER="${DB_WORKER_USER:-erp_worker}"
export DB_WORKER_PASSWORD="${DB_WORKER_PASSWORD:-erp_worker_dev_password}"

psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --no-password \
  --set ON_ERROR_STOP=1 \
  --file /opt/erp/runtime-roles.sql
