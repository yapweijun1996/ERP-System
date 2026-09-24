#!/usr/bin/env bash
# Explicit production database migration.
#
# Keeping this outside release.sh is intentional: a source-only release must be
# able to replace the application without changing client data or schema.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'USAGE'
Usage:
  CONFIRM_DATABASE_CHANGE=YES ./deploy/migrate.sh

Set ERP_DEPLOY_ENV_FILE to an existing protected Compose environment file when
the deployment configuration is held outside this checkout.

This runs the committed Drizzle migrations with the migration owner from
MIGRATION_DATABASE_URL (or the bundled DB_USER/DB_PASSWORD owner URL). Before using
it on a client database, verify a restorable backup and test the release against
a copy/staging database. The script does not create a backup for you.
USAGE
  exit 0
fi

if [[ $# -ne 0 ]]; then
  echo "ERROR: unknown argument: $1" >&2
  exit 2
fi
if [[ "${CONFIRM_DATABASE_CHANGE:-}" != "YES" ]]; then
  echo "ERROR: this changes the database. Set CONFIRM_DATABASE_CHANGE=YES after reviewing the migration and backup." >&2
  exit 2
fi
deploy_env_file="${ERP_DEPLOY_ENV_FILE:-.env}"
if [[ ! -f "$deploy_env_file" ]]; then
  echo "ERROR: deployment environment file is required." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose is required." >&2
  exit 1
fi

compose=(docker compose --env-file "$deploy_env_file" -f docker-compose.yml -f docker-compose.production.yml)
"${compose[@]}" config --quiet
if [[ -n "${ERP_EXPECTED_DB_CONTAINER_ID:-}" ]]; then
  actual_db_container_id="$("${compose[@]}" ps -q db)"
  if [[ "$actual_db_container_id" != "$ERP_EXPECTED_DB_CONTAINER_ID" ]]; then
    echo "ERROR: selected Compose project does not own the expected database container." >&2
    exit 2
  fi
fi

echo "==> Applying committed Drizzle migrations with the migration owner"
echo "    This is the only deployment command in this workflow that changes database schema."
# Build the migration runner from the current checkout. Without --build,
# `docker compose run` may reuse the previously released API image and report
# success while never seeing a newly committed migration file.
"${compose[@]}" --profile migration run --rm --no-deps --build migrator npm run migrate
