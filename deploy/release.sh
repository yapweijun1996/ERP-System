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
release_commit="$(git rev-parse HEAD 2>/dev/null || true)"
if [[ -z "$release_commit" ]]; then
  echo "ERROR: release must run from a Git checkout so the deployed revision is traceable." >&2
  exit 1
fi
if [[ -n "${ERP_RELEASE_COMMIT:-}" && "$ERP_RELEASE_COMMIT" != "$release_commit" ]]; then
  echo "ERROR: ERP_RELEASE_COMMIT ($ERP_RELEASE_COMMIT) does not match Git HEAD ($release_commit)." >&2
  exit 1
fi
export ERP_RELEASE_COMMIT="$release_commit"
"${compose[@]}" config --quiet

echo "==> Releasing application containers only (database is preserved)"
# Recreate every application container after the build. Compose can otherwise keep
# a service running when only the build context changed, leaving API and web on
# different revisions even though both images were rebuilt.
"${compose[@]}" up -d --build --force-recreate --no-deps api web calendar-worker

ready=false
attempt=1
while (( attempt <= 30 )); do
  # The production overlay intentionally removes DB/API host port publishing. Probe from
  # inside nginx instead, so the check exercises the same web -> api proxy path in
  # both the private production network and the local base Compose configuration.
  if "${compose[@]}" exec -T web wget --spider --quiet http://127.0.0.1/health >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
  attempt=$((attempt + 1))
done

if [[ "$ready" != true ]]; then
  echo "ERROR: web/API health check did not pass. Recent logs:" >&2
  "${compose[@]}" logs --tail=80 api web calendar-worker >&2 || true
  exit 1
fi

echo "==> Application release is healthy (web/api/calendar-worker); PostgreSQL was not migrated."
"${compose[@]}" ps
