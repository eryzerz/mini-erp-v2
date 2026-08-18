# SLM ERP

A small invoicing system split into independently deployable backend services
and frontend zones. Backend: four NestJS services. Frontend: three Next.js
apps. They share a typed contract/UI kernel and one end-to-end test that boots
the whole fleet.

## Topology

| Layer | Pieces |
| ----- | ------ |
| Backend | `@repo/api-auth` (users + tokens), `@repo/api-customers`, `@repo/api-invoices`, `@repo/api-dashboard` (read-aggregate, no DB) |
| Frontend | `@repo/zone-dashboard` (login + users admin), `@repo/zone-customers`, `@repo/zone-invoices` |
| Shared kernel | `@repo/contracts` (typed boundaries), `@repo/common`, `@repo/ui`, `@repo/web-shared` (same-origin API + session), `@repo/web-shell` |

Communication is synchronous REST. The browser talks to a single same-origin
`/api/v1`; an edge (Vercel rewrites in production, each zone's `next.config`
locally) proxies each prefix to its service. Services talk to each other over
S2S using a shared-secret JWT plus internal API keys. Each service owns its own
database and an idempotent seed.

## Local development

Prerequisites: Node ≥ 22, pnpm (enabled via `corepack`), Docker.

```sh
# 1. Install workspace dependencies
pnpm install

# 2. Start the database (one Postgres with all six databases, port 5434)
docker compose up -d

# 3. Seed the local environment settings (.env is gitignored)
cp .env.example .env

# 4. Prepare the databases — generates the Prisma clients (gitignored),
#    applies migrations, and seeds the dev databases
pnpm db:prepare

# 5. Run everything: a single browser origin on :3000 in front of the fleet
pnpm dev
```

`pnpm dev` starts the whole fleet with a single-origin entry point
(`scripts/dev-web.mjs` — the same topology the Vercel edge provides in prod,
which is what lets the shared session survive zone-to-zone navigation):

| Origin :3000 path | Backed by |
| ----------------- | --------- |
| `/dashboard`, `/login`, `/users`, `/` | zone-dashboard (:3004) |
| `/customers...` | zone-customers (:3001, `basePath /customers`) |
| `/invoices...` | zone-invoices (:3002, `basePath /invoices`) |
| `/api/v1/{auth,users,customers,invoices,dashboard}/*` | the API services (:4001-:4004) |

Open **http://localhost:3000** and sign in with the seeded demo account:

- Admin: `admin@slm.local` / `admin123`
- Accountant: `accountant@slm.local` / `accountant123`

To skip the proxy and hit each app directly on its own port, use
`pnpm dev:apps` instead. To run a single app (no fleet), use the filter form:

```sh
pnpm --filter @repo/api-invoices dev     # one API (auth/customers/invoices/dashboard)
pnpm --filter @repo/zone-invoices dev    # one zone (on its own port)
```

API docs (Swagger) live at `http://localhost:4001/api/v1/docs` (and the other
service ports).

## Tests

```sh
pnpm typecheck && pnpm lint && pnpm test   # fleet-wide gates + unit tests
pnpm test:e2e                              # per-service e2e suites
pnpm test:e2e:cross                        # boots the whole fleet against the *_test databases
```

`test:e2e:cross` asserts the end-to-end chain: log in, list customers, create
and send a draft invoice (customer snapshot fetched over S2S), and confirm the
dashboard summary reflects it. Zone-level tests are intentionally none;
typecheck plus the fleet e2e cover the frontend contract.

## Deployment

Backends deploy to **Render** as four web services defined in `render.yaml`
(Docker runtime, free plan — first requests cold-start). Each entrypoint runs
`prisma migrate deploy` and its idempotent seed on release, then boots.

| Service | Docs (Swagger) |
| ------- | -------------- |
| slm-api-auth | https://slm-api-auth.onrender.com/api/v1/docs |
| slm-api-customers | https://slm-api-customers.onrender.com/api/v1/docs |
| slm-api-invoices | https://slm-api-invoices.onrender.com/api/v1/docs |
| slm-api-dashboard | https://slm-api-dashboard.onrender.com/api/v1/docs |

Health checks hit `/api/v1/health` on every service.

Databases run on **Neon** (free) — one Postgres per service (`slm_auth`,
`slm_customers`, `slm_invoices`), created in the Neon console. `render.yaml`
marks them `sync: false`, so connection strings live in the Render dashboard.
Secrets (JWT secrets, `INTERNAL_API_KEY`) are dashboard-only as well; the only
values in the repo are the non-secret service URLs and the local
`.env.example` defaults.

Frontends deploy to **Vercel** (one project per zone). Each project:

- `vercel.json` rewrites `/api/v1/{prefix}/*` to the matching Render service,
  mirroring that zone's local `next.config.ts`. `users` → auth is configured
  only on the dashboard zone, which hosts the users admin.
- There are no per-zone API envs — the API is always same-origin `/api/v1`.
- Zone nav bases are env-driven (see `@repo/web-shell`): set
  `NEXT_PUBLIC_DASHBOARD_URL`, `NEXT_PUBLIC_CUSTOMERS_URL`, and
  `NEXT_PUBLIC_INVOICES_URL` to the shared-domain URLs (dashboard at `/`, the
  others at their paths) once the custom domain is attached.

The three zones form a **Vercel Microfrontends** group (edge path-routing on
one custom domain, with the `/api` rewrites above); the group is configured in
the Vercel dashboard, while `vercel.json` carries the API routing.

CI runs the full validation pipeline (build, lint, typecheck, unit and e2e
suites) on every PR and push to `master`. Deploys are the native Git
integrations on Render and Vercel.

## Project structure

```
apps/
  api-auth|api-customers|api-invoices|api-dashboard/   NestJS services (+ prisma/)
  zone-dashboard|zone-customers|zone-invoices/         Next.js 16 apps
libs/common/                                           shared backend helpers (money, guards, S2S)
packages/
  contracts/  typed API boundaries (DTOs + S2S contracts)
  ui/         shadcn-style design system
  web-shared/ same-origin API client + shared session
  web-shell/  shared nav/shell + gates
e2e/                                                   cross-fleet e2e
```
