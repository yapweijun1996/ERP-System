#!/usr/bin/env bash
# Application-only production release.
#
# This deliberately rebuilds/replaces application services only. It never runs Drizzle
# migrations, never seeds data, and never calls `docker compose down -v`.
# Use deploy/migrate.sh separately for a reviewed schema change.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'USAGE'
Usage: ./deploy/release.sh

Rebuild and restart the production web/api containers without touching the
PostgreSQL schema or volumes. Database migrations are a separate, explicit
operation: CONFIRM_DATABASE_CHANGE=YES ./deploy/migrate.sh
USAGE
  exit 0
fi

if [[ $# -ne 0 ]]; then
  echo "ERROR: unknown argument: $1" >&2
  exit 2
fi

if [[ ! -f .env ]]; then
  echo "ERROR: .env is required. Run ./scripts/setup.sh once, then review it." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose is required." >&2
  exit 1
fi

compose=(docker compose -f docker-compose.yml -f docker-compose.production.yml)
"${compose[@]}" config --quiet

echo "==> Releasing application containers only (database is preserved)"
"${compose[@]}" up -d --build --no-deps api web calendar-worker

web_port="$(awk -F= '$1 == "WEB_PORT" {print $2}' .env | tail -n 1)"
web_port="${web_port:-8080}"
ready=false
for i in $(seq 1 30); do
  if curl --fail --silent --show-error "http://127.0.0.1:${web_port}/health" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done

if [[ "$ready" != true ]]; then
  echo "ERROR: web/API health check did not pass. Recent logs:" >&2
  "${compose[@]}" logs --tail=80 api web calendar-worker >&2 || true
  exit 1
fi

echo "==> Application release is healthy (web/api/calendar-worker); PostgreSQL was not migrated."
"${compose[@]}" ps
