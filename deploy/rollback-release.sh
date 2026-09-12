#!/usr/bin/env bash
# Application-only rollback to explicitly supplied image references.
#
# This never runs migrations, seeds data, or removes PostgreSQL/document volumes.
# Execution requires an explicit confirmation variable; use --plan to validate
# the service set without touching Docker.
set -euo pipefail

cd "$(dirname "$0")/.."

api_image="${ERP_ROLLBACK_API_IMAGE:-}"
web_image="${ERP_ROLLBACK_WEB_IMAGE:-}"
calendar_image="${ERP_ROLLBACK_CALENDAR_IMAGE:-}"
plan=false

usage() {
  cat <<'USAGE'
Usage:
  ./deploy/rollback-release.sh --plan \
    --api-image <image> --web-image <image> --calendar-worker-image <image>

  CONFIRM_RELEASE_ROLLBACK=YES \
    ERP_ROLLBACK_API_IMAGE=<image> \
    ERP_ROLLBACK_WEB_IMAGE=<image> \
    ERP_ROLLBACK_CALENDAR_IMAGE=<image> \
    ./deploy/rollback-release.sh

Image references must be immutable `@sha256:<64-hex>` digests. The plan mode
validates the three application image references without Docker.
Execution verifies that each image exists locally, writes a restrictive temporary
Compose override, recreates only api/web/calendar-worker, and checks web -> nginx
-> api /health. PostgreSQL schema, data and named volumes are untouched.
USAGE
}

fail() {
  echo "ERROR: $1" >&2
  exit 2
}

validate_image_ref() {
  local value="$1"
  local service="$2"
  if [[ -z "$value" || ${#value} -gt 255 ]]; then
    fail "${service} rollback image reference is missing or too long."
  fi
  if [[ ! "$value" =~ ^[A-Za-z0-9][A-Za-z0-9._/@:-]*$ ]]; then
    fail "${service} rollback image reference contains unsafe characters."
  fi
  if [[ ! "$value" =~ @sha256:[0-9a-f]{64}$ ]]; then
    fail "${service} rollback image reference must be an immutable sha256 digest."
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --plan)
      plan=true
      shift
      ;;
    --api-image)
      [[ $# -ge 2 ]] || fail "--api-image requires a value."
      [[ -z "$api_image" ]] || fail "api rollback image was supplied more than once."
      api_image="$2"
      shift 2
      ;;
    --web-image)
      [[ $# -ge 2 ]] || fail "--web-image requires a value."
      [[ -z "$web_image" ]] || fail "web rollback image was supplied more than once."
      web_image="$2"
      shift 2
      ;;
    --calendar-worker-image)
      [[ $# -ge 2 ]] || fail "--calendar-worker-image requires a value."
      [[ -z "$calendar_image" ]] || fail "calendar-worker rollback image was supplied more than once."
      calendar_image="$2"
      shift 2
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

validate_image_ref "$api_image" "api"
validate_image_ref "$web_image" "web"
validate_image_ref "$calendar_image" "calendar-worker"

if [[ "$plan" == true ]]; then
  printf '%s\n' '{"status":"planned","services":["api","web","calendar-worker"],"database":"unchanged","volumes":"unchanged","healthPath":"web->nginx->api /health"}'
  exit 0
fi

if [[ "${CONFIRM_RELEASE_ROLLBACK:-}" != "YES" ]]; then
  echo "ERROR: rollback changes running application containers. Set CONFIRM_RELEASE_ROLLBACK=YES after reviewing the image references and backup." >&2
  exit 2
fi
if [[ ! -f .env ]]; then
  echo "ERROR: .env is required. Review the target Compose project before rollback." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose is required." >&2
  exit 1
fi

compose=(docker compose -f docker-compose.yml -f docker-compose.production.yml)
for image in "$api_image" "$web_image" "$calendar_image"; do
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    echo "ERROR: rollback image is not available locally." >&2
    exit 1
  fi
done

rollback_override=""
cleanup() {
  if [[ -n "$rollback_override" ]]; then
    rm -f -- "$rollback_override"
  fi
}
trap cleanup EXIT

tmp_root="${TMPDIR:-/tmp}"
rollback_override="$(mktemp "${tmp_root%/}/erp-rollback.XXXXXX.yml")"
chmod 600 "$rollback_override"
cat >"$rollback_override" <<YAML
services:
  api:
    image: ${api_image}
  web:
    image: ${web_image}
  calendar-worker:
    image: ${calendar_image}
YAML

compose+=( -f "$rollback_override" )
"${compose[@]}" config --quiet
echo "==> Rolling back application containers only (database and volumes are preserved)"
"${compose[@]}" up -d --no-build --force-recreate --no-deps api web calendar-worker

ready=false
attempt=1
while (( attempt <= 30 )); do
  if "${compose[@]}" exec -T web wget --spider --quiet http://127.0.0.1/health >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
  attempt=$((attempt + 1))
done

if [[ "$ready" != true ]]; then
  echo "ERROR: rolled-back web/API health check did not pass; leave the stack stopped or restore the reviewed backup according to the incident runbook." >&2
  exit 1
fi

echo "==> Application rollback is healthy (web/api/calendar-worker); PostgreSQL was not migrated."
"${compose[@]}" ps
