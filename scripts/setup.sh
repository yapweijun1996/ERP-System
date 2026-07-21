#!/usr/bin/env bash
# One-command setup for the ERP System (production/Docker mode).
# Usage: ./scripts/setup.sh                 (or: make setup)
#        ./scripts/setup.sh --interactive   (or: make setup-interactive)
#
# Idempotent: safe to run repeatedly. Creates .env if missing, starts Docker
# services, waits for the database to be ready, applies migrations, and seeds
# the SG + MY demo companies.
#
# --interactive/-i only changes step 1, and only when .env does not exist yet
# (the never-overwrite contract below is unchanged). Instead of copying
# .env.example verbatim (placeholder DB password, blank tokens), it prompts
# for a bundled-vs-external database, auto-generates strong secrets on blank
# answers, and checks host ports for collisions before anything starts.
set -euo pipefail

cd "$(dirname "$0")/.."

INTERACTIVE=false
for arg in "$@"; do
  case "$arg" in
    --interactive|-i) INTERACTIVE=true ;;
    *)
      echo "ERROR: unknown argument: $arg (expected --interactive/-i)" >&2
      exit 1
      ;;
  esac
done

echo "==> ERP System setup"

EXTERNAL_DB=false

# True (0) if something is already listening on 127.0.0.1:$1. Uses bash's
# /dev/tcp instead of a new dependency (nc/lsof aren't guaranteed present).
port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# Prints an available port starting at $1, warning on stderr and counting up
# past anything already bound (e.g. another project's container).
find_free_port() {
  local port="$1" label="$2"
  while port_in_use "$port"; do
    echo "    port $port ($label) is already in use — trying $((port + 1))" >&2
    port="$((port + 1))"
  done
  printf '%s' "$port"
}

# sed -i differs between GNU and BSD/macOS sed; the -i.bak + rm form works on
# both without relying on GNU-only bare `-i`.
sed_replace() {
  sed -i.bak -e "$1" .env
  rm -f .env.bak
}

# Mirrors src/auth/tokenCrypto.ts's parseTokenEncryptionKey exactly (64-char hex,
# or base64 decoding to exactly 32 bytes) — a manually-typed key that fails this
# makes the api container crash at boot with no hint pointing back to .env, so
# catch it here instead.
valid_encryption_key() {
  if [[ "$1" =~ ^[a-fA-F0-9]{64}$ ]]; then
    return 0
  fi
  local byte_len
  byte_len="$(printf '%s' "$1" | openssl base64 -d -A 2>/dev/null | wc -c | tr -d ' ')"
  [ "$byte_len" = "32" ]
}

run_interactive_setup() {
  echo "==> Interactive setup — press Enter to accept a default or auto-generate."
  echo

  local db_choice db_password="" database_url=""
  while true; do
    read -r -p "Database — [1] bundled Docker container  [2] already-provisioned external database [1]: " db_choice || true
    db_choice="${db_choice:-1}"
    case "$db_choice" in
      1|2) break ;;
      *) echo "    please enter 1 or 2" ;;
    esac
  done

  if [ "$db_choice" = "2" ]; then
    EXTERNAL_DB=true
    while true; do
      read -r -p "External database connection string (postgres://user:pass@host:port/db): " database_url || true
      case "$database_url" in
        postgres://*|postgresql://*) break ;;
        *) echo "    must start with postgres:// or postgresql://" ;;
      esac
    done
  else
    read -r -p "Database password (blank = auto-generate a strong one): " db_password || true
    if [ -z "$db_password" ]; then
      db_password="$(openssl rand -hex 20)"
      echo "    generated a database password"
    fi
  fi

  local setup_token="" enc_key="" public_url
  read -r -p "ERP_SETUP_TOKEN (blank = auto-generate): " setup_token || true
  if [ -z "$setup_token" ]; then
    setup_token="$(openssl rand -base64 32)"
    echo "    generated ERP_SETUP_TOKEN"
  fi

  while true; do
    read -r -p "ERP_TOKEN_ENCRYPTION_KEY (blank = auto-generate): " enc_key || true
    if [ -z "$enc_key" ]; then
      enc_key="$(openssl rand -base64 32)"
      echo "    generated ERP_TOKEN_ENCRYPTION_KEY"
      break
    fi
    if valid_encryption_key "$enc_key"; then
      break
    fi
    echo "    must be a 32-byte base64 string or a 64-character hex string"
  done

  read -r -p "ERP_PUBLIC_URL [http://localhost:8080]: " public_url || true
  public_url="${public_url:-http://localhost:8080}"

  echo
  echo "==> Checking host ports..."
  local web_port api_port db_port=""
  web_port="$(find_free_port 8080 WEB_PORT)"
  api_port="$(find_free_port 3000 API_PORT)"
  if [ "$EXTERNAL_DB" = false ]; then
    db_port="$(find_free_port 5432 DB_PORT)"
  fi

  cp .env.example .env

  sed_replace "s|^ERP_SETUP_TOKEN=.*|ERP_SETUP_TOKEN=${setup_token}|"
  sed_replace "s|^ERP_TOKEN_ENCRYPTION_KEY=.*|ERP_TOKEN_ENCRYPTION_KEY=${enc_key}|"
  sed_replace "s|^ERP_PUBLIC_URL=.*|ERP_PUBLIC_URL=${public_url}|"

  if [ "$EXTERNAL_DB" = true ]; then
    sed_replace "s|^# DATABASE_URL=.*|DATABASE_URL=${database_url}|"
  else
    sed_replace "s|^DB_PASSWORD=.*|DB_PASSWORD=${db_password}|"
  fi

  # Anchored to the standalone "# WEB_PORT=18080"-style placeholder line only
  # ([0-9]*$ = digits then end-of-line) — .env.example's port-override prose
  # comment above it also contains the literal text "API_PORT=3000," mid-
  # sentence, which a bare ".*" pattern would corrupt too.
  [ "$web_port" != "8080" ] && sed_replace "s|^# WEB_PORT=[0-9]*\$|WEB_PORT=${web_port}|"
  [ "$api_port" != "3000" ] && sed_replace "s|^# API_PORT=[0-9]*\$|API_PORT=${api_port}|"
  if [ "$EXTERNAL_DB" = false ] && [ "$db_port" != "5432" ]; then
    sed_replace "s|^# DB_PORT=[0-9]*\$|DB_PORT=${db_port}|"
  fi

  echo "    wrote .env"
}

# 1. Ensure .env exists (never overwrite an existing one).
if [ ! -f .env ]; then
  if [ "$INTERACTIVE" = true ]; then
    run_interactive_setup
  else
    cp .env.example .env
    echo "    created .env from .env.example  (edit DB_PASSWORD before production use)"
  fi
else
  echo "    .env already present — leaving it untouched"
  if [ "$INTERACTIVE" = true ]; then
    echo "    (--interactive only writes a first-time .env — reusing the existing one)"
    # Only inferred under --interactive, so the plain/default path below (the
    # one required to stay byte-for-byte unchanged) never runs this check.
    if grep -qE '^DATABASE_URL=.+' .env 2>/dev/null; then
      EXTERNAL_DB=true
    fi
  fi
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

# 3. Start services. An external database is never started or waited on
#    locally — only api+web come up, talking to DATABASE_URL from .env.
if [ "$EXTERNAL_DB" = true ]; then
  echo "==> Starting services (api + web only — external database)..."
  docker compose up -d api web --no-deps
else
  echo "==> Starting services (db + api + web)..."
  docker compose up -d
fi

# 4. Wait for the database to accept connections (health gate, not a fixed
#    sleep), then apply migrations.
if [ "$EXTERNAL_DB" = true ]; then
  echo "==> Waiting for the external database to accept migrations..."
  migrate_log="$(mktemp)"
  trap 'rm -f "$migrate_log"' EXIT
  ready=false
  for i in $(seq 1 30); do
    if docker compose exec -T api npm run migrate >"$migrate_log" 2>&1; then
      echo "    migrations applied — external database is reachable."
      ready=true
      break
    fi
    sleep 2
  done
  if [ "$ready" = false ]; then
    echo "ERROR: could not reach/migrate the external database in time. Last attempt:" >&2
    cat "$migrate_log" >&2
    exit 1
  fi
else
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

  # 5. Apply migrations (external DB already migrated as its readiness proof above).
  echo "==> Applying database migrations..."
  docker compose exec -T api npm run migrate
fi

# 6. Seed demo data (SG + MY companies under one master).
echo "==> Seeding sample data..."
docker compose exec -T api npm run seed || echo "    (seed skipped or already applied)"

WEB_PORT_ACTUAL="$(grep -E '^WEB_PORT=' .env | cut -d= -f2- || echo 8080)"
API_PORT_ACTUAL="$(grep -E '^API_PORT=' .env | cut -d= -f2- || echo 3000)"
DB_PORT_ACTUAL="$(grep -E '^DB_PORT=' .env | cut -d= -f2- || echo 5432)"

echo
echo "==> Setup complete."
echo
echo "   Web app : http://localhost:${WEB_PORT_ACTUAL:-8080}"
echo "   API     : http://localhost:${API_PORT_ACTUAL:-3000}"
if [ "$EXTERNAL_DB" = false ]; then
  echo "   Postgres: localhost:${DB_PORT_ACTUAL:-5432}  (db: erp)"
fi
echo
echo "   make logs    # tail logs"
echo "   make psql    # open a database shell"
echo "   make reset   # wipe and start over (DESTRUCTIVE)"
