#!/bin/bash
# ── Safe migration script ──
# Applies the additive migration to the production database.
# ONLY adds missing columns/tables — never drops or modifies.
# Usage: bash scripts/migrate-safe.sh
#
# Set DATABASE_URL to your Neon PostgreSQL URL before running:
#   DATABASE_URL=postgresql://... bash scripts/migrate-safe.sh

cd "$(dirname "$0")/.."

# Load .env if DATABASE_URL not already set
if [ -z "$DATABASE_URL" ]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    case "$key" in
      DATABASE_URL) export "$key=$value" ;;
    esac
  done < .env
fi

echo "DATABASE_URL: ${DATABASE_URL:0:30}..."
echo ""
echo "Running prisma migrate deploy..."
npx prisma migrate deploy

echo ""
echo "Done. Clearing .next cache..."
rm -rf .next

echo "Migration complete."
