# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
# The generated Prisma client is gitignored and needed both to build api-auth
# and to run the deploy-time seed, so generate it here (after COPY, which
# already skipped it).
RUN pnpm --filter @repo/api-auth db:generate
RUN pnpm exec turbo run build --filter=@repo/api-auth

FROM node:22-alpine AS runner
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api-auth/node_modules ./apps/api-auth/node_modules
COPY --from=builder /app/apps/api-auth/dist ./apps/api-auth/dist
COPY --from=builder /app/apps/api-auth/src/generated ./apps/api-auth/src/generated
COPY --from=builder /app/apps/api-auth/package.json ./apps/api-auth/package.json
COPY --from=builder /app/apps/api-auth/prisma ./apps/api-auth/prisma
COPY --from=builder /app/apps/api-auth/prisma.config.ts ./apps/api-auth/prisma.config.ts
COPY --from=builder /app/apps/api-auth/docker-entrypoint.sh ./apps/api-auth/docker-entrypoint.sh
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/nest-cli.json ./nest-cli.json

RUN chmod +x /app/apps/api-auth/docker-entrypoint.sh

# No EXPOSE: the app listens on the platform-injected PORT. Declaring a port
# here can make Render route health checks to a fixed port nothing listens on.

ENTRYPOINT ["/app/apps/api-auth/docker-entrypoint.sh"]
