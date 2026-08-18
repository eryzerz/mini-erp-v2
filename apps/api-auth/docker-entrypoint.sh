#!/bin/sh
set -e

echo "Applying database migrations..."
cd /app/apps/api-auth
node_modules/.bin/prisma migrate deploy

echo "Seeding demo data (idempotent)..."
node_modules/.bin/tsx prisma/seed.ts

echo "Starting api-auth..."
cd /app
exec node apps/api-auth/dist/src/main.js
