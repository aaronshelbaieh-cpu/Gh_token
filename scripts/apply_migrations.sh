#!/usr/bin/env bash
# Apply GED Phase 1 migrations in order.
set -euo pipefail

DB_NAME="${1:-ged}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS="$ROOT/db/migrations"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL client tools first." >&2
  exit 1
fi

echo "Ensuring database '${DB_NAME}' exists…"
if command -v createdb >/dev/null 2>&1; then
  createdb "$DB_NAME" 2>/dev/null || true
else
  psql -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
    || psql -d postgres -c "CREATE DATABASE ${DB_NAME};"
fi

for f in \
  001_extensions.sql \
  002_schema.sql \
  003_indexes_constraints.sql \
  004_seed_categories_services.sql \
  005_seed_uk_locations.sql
do
  echo "→ Applying ${f}"
  psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$MIGRATIONS/$f"
done

echo "Done. Overview:"
psql -d "$DB_NAME" -c "SELECT * FROM v_admin_overview;"
psql -d "$DB_NAME" -c "SELECT count(*) AS categories FROM categories;"
psql -d "$DB_NAME" -c "SELECT count(*) AS services FROM services;"
psql -d "$DB_NAME" -c "SELECT location_type, count(*) FROM locations GROUP BY 1 ORDER BY 1;"
