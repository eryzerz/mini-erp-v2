# SLM ERP — fleet edition

A full-stack take-home ERP, split into independently deployable pieces after the
original monolith (wayfinder effort `slm-erp-msa`). Four NestJS backend
services, three Next.js zones, a shared typed contract/UI kernel, and one
cross-fleet e2e.

## Topology

| Layer | Pieces |
| ----- | ------ |
| Backend | `@repo/api-auth` (users + tokens), `@repo/api-customers`, `@repo/api-invoices`, `@repo/api-dashboard` (read-aggregate, no DB) |
| Frontend | `@repo/zone-dashboard` (login + users admin), `@repo/zone-customers`, `@repo/zone-invoices` |
| Shared kernel | `@repo/contracts` (typed boundaries), `@repo/common`, `@repo/ui`, `@repo/web-shared` (same-origin API + session), `@repo/web-shell` |

Communication: synchronous REST, one same-origin `/api/v1` from the browser
(the edge proxies each prefix to its service), S2S over shared-secret JWT +
internal API keys, one database per service with idempotent seeds.

## Local development

Prerequisites: Node ≥ 22, pnpm (via corepack), Docker.

```sh
pnpm install
docker compose up -d     # one Postgres, all six databases via db-init
pnpm dev                 # migrates + seeds, then runs every app (API :4001-:4004, zones :3000-:3002)
```

Each zone proxies `/api/v1/{auth,users,customers,invoices,dashboard}/*` to the
locally-running services (same rewrites the edges use in production). Sign in
with `admin@slm.local` / `admin123`.

## Tests

```sh
pnpm typecheck && pnpm lint && pnpm test   # fleet-wide gates + unit tests
pnpm test:e2e                              # per-service e2e suites
pnpm test:e2e:cross                        # boots the whole fleet against the *_test DBs
```

`test:e2e:cross` asserts the boundary chain: login → list customers → create +
send a draft (customer snapshot fetched over S2S) → dashboard summary reflects
it. Zone-level tests are intentionally none (ticket 11); typecheck + the fleet
e2e cover the frontend contract.

## Deployment

Backends deploy to **Render** (4 web services from `render.yaml`, Docker
runtime, `plan: free` — first requests cold-start). Each entrypoint runs
`prisma migrate deploy` + its idempotent seed on release, then boots.

| Service | Docs (Swagger) |
| ------- | -------------- |
| slm-api-auth | https://slm-api-auth.onrender.com/api/v1/docs |
| slm-api-customers | https://slm-api-customers.onrender.com/api/v1/docs |
| slm-api-invoices | https://slm-api-invoices.onrender.com/api/v1/docs |
| slm-api-dashboard | https://slm-api-dashboard.onrender.com/api/v1/docs |

Health checks hit `/api/v1/health` on every service.

Databases are **Neon** free — one Postgres per service (`slm_auth`,
`slm_customers`, `slm_invoices`), created in the Neon console. `render.yaml`
keeps them `sync: false` so the connection strings live in the Render
dashboard, never in the repo. Secrets (JWT secrets, `INTERNAL_API_KEY`) are
likewise dashboard-only; the only repo envs are the non-secret service URLs and
the local `.env.example` defaults.

Frontends deploy to **Vercel** (one project per zone). Each project:
- `vercel.json` rewrites `/api/v1/{prefix}/*` to the matching Render service
  (the prefix set mirrors that zone's local `next.config.ts`; `users` → auth is
  only on the dashboard zone, which hosts the users admin).
- No per-zone API env—the API is always same-origin `/api/v1`.
- Zone nav bases are env-driven (see `@repo/web-shell`): set
  `NEXT_PUBLIC_DASHBOARD_URL` / `NEXT_PUBLIC_CUSTOMERS_URL` /
  `NEXT_PUBLIC_INVOICES_URL` to the shared-domain URLs (dashboard `/`, zones at
  their path) once the custom domain is attached.

The three zones are meant to be grouped as a **Vercel Microfrontends** group
(edge path-routing on one custom domain, with `/api` rewrites above) — the
group itself is configured in the Vercel dashboard; `vercel.json` carries the
API routing.

CI runs the full validation pipeline (build, lint, typecheck, unit + e2e
suites) on every PR and push to `master`; deploys are native Git integrations
on Render and Vercel.

## Project structure

```
apps/
  api-auth|api-customers|api-invoices|api-dashboard/   NestJS services (+ prisma/)
  zone-dashboard|zone-customers|zone-invoices/         Next.js 16 apps
libs/common/                                           shared backend helpers (money, guards, S2S)
packages/
  contracts/  typed API boundaries (Dtos + S2S contracts)
  ui/         shadcn-style design system
  web-shared/ same-origin API client + shared session
  web-shell/  shared nav/shell + gates
e2e/                                                   cross-fleet e2e
```
