#!/usr/bin/env sh
set -e

export PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-career_groove}"
export POSTGRES_DB="${POSTGRES_DB:-careergroove}"
export DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
export PGPASSWORD="${POSTGRES_PASSWORD}"
export AUTH_SECRET="${AUTH_SECRET:-career_groove_v2_default_secret}"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-${AUTH_SECRET}}"
export ENCRYPTION_KEY="${ENCRYPTION_KEY:-career_groove_v2_default_encryption}"
export BOOTSTRAP_ADMIN_EMAIL="${BOOTSTRAP_ADMIN_EMAIL:-rbtm2006@me.com}"
export BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:3000}"
export SELF_ORIGIN="${SELF_ORIGIN:-http://localhost:3000}"
export PORT="${PORT:-3000}"

mkdir -p "$PGDATA"
chown -R postgres:postgres "$PGDATA"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "entrypoint: initializing database cluster"
  su postgres -c "/usr/local/bin/initdb -D $PGDATA"
fi

echo "entrypoint: starting PostgreSQL"
su postgres -c "/usr/local/bin/pg_ctl -D $PGDATA -l /tmp/pg.log -o '-p 5432 -c listen_addresses=localhost' -w --timeout=120 start"

for i in $(seq 1 60); do
  if su postgres -c "psql -h localhost -U postgres -tAc 'SELECT 1'" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

su postgres -c "psql -h localhost -U postgres -tAc \"CREATE DATABASE ${POSTGRES_DB}\"" || true

echo "entrypoint: running migrations"
bun scripts/migrate.ts

echo "entrypoint: seeding data"
bun scripts/seed.ts

echo "entrypoint: starting app on port ${PORT}"
exec bun build/index.js