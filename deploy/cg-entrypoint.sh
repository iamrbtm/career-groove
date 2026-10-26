#!/bin/sh
set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data/pgdata}"
PG_BASE="$(dirname "$PGDATA")"

mkdir -p "$PG_BASE" /run/postgresql /data /app/backups
chown -R postgres:postgres "$PG_BASE" /run/postgresql 2>/dev/null || true
chown -R redis:redis /data 2>/dev/null || true
chown node:node /app/backups 2>/dev/null || true

if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "First boot: initializing postgres data directory..."
    printf 'career_groove' > /tmp/cg-pwfile
    chown postgres:postgres /tmp/cg-pwfile
    su postgres -c "initdb -D '$PGDATA' -U career_groove -A scram-sha-256 --auth-local=trust --pwfile=/tmp/cg-pwfile" >/dev/null
    rm -f /tmp/cg-pwfile
    printf "listen_addresses = '*'\npassword_encryption = scram-sha-256\nunix_socket_directories = '/run/postgresql'\n" >> "$PGDATA/postgresql.conf"
    printf "host all all 0.0.0.0/0 scram-sha-256\nhost all all ::/0 scram-sha-256\n" >> "$PGDATA/pg_hba.conf"
fi

exec /usr/bin/supervisord -c /etc/supervisord.conf
