#!/bin/bash
# Dev server startup script
# Forces correct DATABASE_URL from .env (system env var may override .env)
cd "$(dirname "$0")/.."

# Read critical env vars from .env file (these override system env)
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ "$key" =~ ^#.*$ ]] && continue
  [[ -z "$key" ]] && continue
  # Only export critical vars
  case "$key" in
    DATABASE_URL|NEXTAUTH_URL|NEXTAUTH_SECRET|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|SUPER_ADMIN_EMAILS)
      export "$key=$value"
      ;;
  esac
done < .env

exec npx next dev -p 3000 2>&1 | tee dev.log
