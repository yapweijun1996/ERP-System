#!/usr/bin/env bash
# One-command setup for the ERP System (production/Docker mode).
# Usage: ./scripts/setup.sh   (or: make setup)
#
# Idempotent: safe to run repeatedly. Creates .env if missing, starts Docker
# services, waits for PostgreSQL to be healthy, applies migrations, and seeds
# the SG + MY demo companies.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> ERP System setup"

# 1. Ensure .env exists (never overwrite an existing one).
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    created .env from .env.example  (edit DB_PASSWORD before production use)"
else
  echo "    .env already present — leaving it untouched"
fi

# 2. Pre-flight: Docker must be available.
if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found. Install Docker Desktop first." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: 'docker compose' not available. Update Docker." >&2
  exit 1
fi

# 3. Start services.
echo "==> Starting services (db + api + web)..."
docker compose up -d

# 4. Wait for PostgreSQL to accept connections (health gate, not a fixed sleep).
echo "==> Waiting for PostgreSQL to be ready..."
DB_USER="$(grep -E '^DB_USER=' .env | cut -d= -f2- || echo erp)"
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U "${DB_USER:-erp}" -d erp >/dev/null 2>&1; then
    echo "    database is ready."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERROR: database did not become ready in time. Check 'make logs'." >&2
    exit 1
  fi
  sleep 2
done

# 5. Apply migrations.
echo "==> Applying database migrations..."
docker compose exec -T api npm run migrate

# 6. Seed demo data (SG + MY companies under one master).
echo "==> Seeding sample data..."
docker compose exec -T api npm run seed || echo "    (seed skipped or already applied)"

cat <<'EOF'

==> Setup complete.

   Web app : http://localhost:8080
   API     : http://localhost:3000
   Postgres: localhost:5432  (db: erp)

   make logs    # tail logs
   make psql    # open a database shell
   make reset   # wipe and start over (DESTRUCTIVE)
EOF
