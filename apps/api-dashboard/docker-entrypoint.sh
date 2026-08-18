#!/bin/sh
set -e

echo "Starting api-dashboard..."
cd /app
exec node apps/api-dashboard/dist/src/main.js
