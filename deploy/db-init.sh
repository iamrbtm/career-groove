#!/bin/sh
set -e

rm -f /tmp/.cg-ready

echo "db-init: waiting for postgres..."
until pg_isready -h 127.0.0.1 -p "${PGPORT:-5432}" -q; do
    sleep 1
done

export PGPASSWORD="${POSTGRES_PASSWORD:-career_groove}"
PSQL="psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p ${PGPORT:-5432} -U career_groove"

echo "db-init: ensuring role password..."
$PSQL -d postgres -c "ALTER USER career_groove WITH PASSWORD '${POSTGRES_PASSWORD:-career_groove}';" >/dev/null

echo "db-init: ensuring database career_groove..."
if ! $PSQL -tAc "SELECT 1 FROM pg_database WHERE datname='career_groove'" | grep -q 1; then
    $PSQL -d postgres -c "CREATE DATABASE career_groove OWNER career_groove"
fi

echo "db-init: running schema migrations..."
unset PGPASSWORD
if ! node /app/scripts/migrate.mjs; then
    echo "db-init: migrations failed after retries" >&2
    rm -f /tmp/.cg-ready
    exit 1
fi

touch /tmp/.cg-ready
echo "db-init: done."
