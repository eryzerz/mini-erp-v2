# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
# The generated Prisma client is gitignored and needed both to build api-customers
# and to run the deploy-time seed, so generate it here (after COPY, which
# already skipped it).
RUN pnpm --filter @repo/api-customers db:generate
RUN pnpm exec turbo run build --filter=@repo/api-customers

FROM node:22-alpine AS runner
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api-customers/node_modules ./apps/api-customers/node_modules
COPY --from=builder /app/apps/api-customers/dist ./apps/api-customers/dist
COPY --from=builder /app/apps/api-customers/src/generated ./apps/api-customers/src/generated
COPY --from=builder /app/apps/api-customers/prisma ./apps/api-customers/prisma
COPY --from=builder /app/apps/api-customers/prisma.config.ts ./apps/api-customers/prisma.config.ts
COPY --from=builder /app/apps/api-customers/package.json ./apps/api-customers/package.json
COPY --from=builder /app/apps/api-customers/docker-entrypoint.sh ./apps/api-customers/docker-entrypoint.sh
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/nest-cli.json ./nest-cli.json

RUN chmod +x /app/apps/api-customers/docker-entrypoint.sh

# No EXPOSE: the app listens on the platform-injected PORT. Declaring a port
# here can make Render route health checks to a fixed port nothing listens on.

ENTRYPOINT ["/app/apps/api-customers/docker-entrypoint.sh"]
