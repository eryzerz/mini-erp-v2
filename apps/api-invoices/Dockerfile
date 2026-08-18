# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
# The generated Prisma client is gitignored and needed both to build api-invoices
# and to run the deploy-time seed, so generate it here (after COPY, which
# already skipped it).
RUN pnpm --filter @repo/api-invoices db:generate
RUN pnpm exec turbo run build --filter=@repo/api-invoices

FROM node:22-alpine AS runner
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api-invoices/node_modules ./apps/api-invoices/node_modules
COPY --from=builder /app/apps/api-invoices/dist ./apps/api-invoices/dist
COPY --from=builder /app/apps/api-invoices/src/generated ./apps/api-invoices/src/generated
COPY --from=builder /app/apps/api-invoices/prisma ./apps/api-invoices/prisma
COPY --from=builder /app/apps/api-invoices/prisma.config.ts ./apps/api-invoices/prisma.config.ts
COPY --from=builder /app/apps/api-invoices/package.json ./apps/api-invoices/package.json
COPY --from=builder /app/apps/api-invoices/docker-entrypoint.sh ./apps/api-invoices/docker-entrypoint.sh
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/nest-cli.json ./nest-cli.json

RUN chmod +x /app/apps/api-invoices/docker-entrypoint.sh

# No EXPOSE: the app listens on the platform-injected PORT. Declaring a port
# here can make Render route health checks to a fixed port nothing listens on.

ENTRYPOINT ["/app/apps/api-invoices/docker-entrypoint.sh"]
