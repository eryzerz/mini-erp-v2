#!/bin/sh
set -e

echo "Applying database migrations..."
cd /app/apps/api-customers
node_modules/.bin/prisma migrate deploy

echo "Seeding demo data (idempotent)..."
node_modules/.bin/tsx prisma/seed.ts

echo "Starting api-customers..."
cd /app
exec node apps/api-customers/dist/src/main.js
