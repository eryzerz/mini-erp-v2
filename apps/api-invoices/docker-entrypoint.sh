#!/bin/sh
set -e

echo "Applying database migrations..."
cd /app/apps/api-invoices
node_modules/.bin/prisma migrate deploy

echo "Seeding demo data (idempotent)..."
node_modules/.bin/tsx prisma/seed.ts

echo "Starting api-invoices..."
cd /app
exec node apps/api-invoices/dist/src/main.js
