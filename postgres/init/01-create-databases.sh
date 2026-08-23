#!/bin/bash
# Creates the per-service databases on a FRESH Postgres volume.
#
# Postgres runs everything in /docker-entrypoint-initdb.d/ exactly once, when it
# initialises an empty data directory. If your volume already exists — and it
# does, if you have been running this project — this script will NOT run, and
# `maintenance_db` has to be created by hand once:
#
#   docker compose exec postgres psql -U hostel -d hostel_db -c "CREATE DATABASE maintenance_db;"
#
# Each service owns its own database. That is what makes a join across the
# service boundary impossible rather than merely discouraged.
set -euo pipefail

for db in maintenance_db; do
  echo "[init] ensuring database: $db"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE $db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
done

echo "[init] per-service databases ready"
