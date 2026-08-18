/**
 * Single-origin local dev launcher (wayfinder ticket 07): one browser origin on
 * PORT (default :3000) that routes each zone and the API fleet by path prefix —
 * the same topology the Vercel edge + microfrontends group provide in prod. This
 * keeps sessionStorage shared across zones, so cross-zone navigation keeps the
 * session instead of bouncing to login (three separate dev origins would not).
 *
 * Routing:
 *   /api/v1/{auth,users}/*        -> api-auth       (:4001)
 *   /api/v1/customers/*           -> api-customers  (:4002)
 *   /api/v1/invoices/*            -> api-invoices   (:4003)
 *   /api/v1/dashboard/*           -> api-dashboard  (:4004)
 *   /customers*                   -> zone-customers (:3001, basePath /customers)
 *   /invoices*                    -> zone-invoices  (:3002, basePath /invoices)
 *   everything else (/dashboard, /login, /users, /_next, /) -> zone-dashboard (:3004)
 *
 * Usage: `pnpm dev` (starts `turbo run dev` underneath, then this proxy).
 */
import { createServer, request as httpRequest } from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";

const PORT = Number(process.env.DEV_WEB_PORT ?? 3000);

const TARGETS = {
  "api/auth": `http://127.0.0.1:${process.env.AUTH_PORT ?? 4001}`,
  "api/users": `http://127.0.0.1:${process.env.AUTH_PORT ?? 4001}`,
  "api/customers": `http://127.0.0.1:${process.env.CUSTOMERS_API_PORT ?? 4002}`,
  "api/invoices": `http://127.0.0.1:${process.env.INVOICES_API_PORT ?? 4003}`,
  "api/dashboard": `http://127.0.0.1:${process.env.DASHBOARD_API_PORT ?? 4004}`,
  customers: `http://127.0.0.1:${process.env.CUSTOMERS_ZONE_PORT ?? 3001}`,
  invoices: `http://127.0.0.1:${process.env.INVOICES_ZONE_PORT ?? 3002}`,
  dashboard: `http://127.0.0.1:${process.env.DASHBOARD_ZONE_PORT ?? 3004}`,
};

const matches = (pathname, prefix) => pathname === prefix || pathname.startsWith(prefix + "/");

const targetFor = (pathname) => {
  if (matches(pathname, "/api/v1/auth")) return TARGETS["api/auth"];
  if (matches(pathname, "/api/v1/users")) return TARGETS["api/users"];
  if (matches(pathname, "/api/v1/customers")) return TARGETS["api/customers"];
  if (matches(pathname, "/api/v1/invoices")) return TARGETS["api/invoices"];
  if (matches(pathname, "/api/v1/dashboard")) return TARGETS["api/dashboard"];
  if (matches(pathname, "/customers")) return TARGETS.customers;
  if (matches(pathname, "/invoices")) return TARGETS.invoices;
  return TARGETS.dashboard;
};

// Ports each process in the dev topology is expected to own.
const EXPECTED_PORTS = [
  ...new Set([
    PORT,
    ...Object.values(TARGETS).map((url) => new URL(url).port),
  ]),
].map(Number);

const listenCheck = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });

// Fail fast with a clear report instead of a half-broken `pnpm dev`: a stale
// fleet (or a previous run that was Ctrl-C'd awkwardly) leaves listeners on the
// dev ports, and the tasks then die one by one with opaque EADDRINUSE noise.
const refuseIfPortsBusy = async () => {
  const result = await Promise.all(
    EXPECTED_PORTS.map(async (port) => ({ port, busy: await listenCheck(port) })),
  );
  const busy = result.filter((r) => r.busy);
  if (busy.length === 0) {
    return;
  }
  console.error("\n[dev-web] Ports already in use — a previous dev fleet is still running:");
  for (const { port } of busy) {
    console.error(`  :${port}`);
  }
  console.error("\nStop it first, e.g. for each port:  kill -9 $(lsof -ti :PORT)");
  console.error("or, on Linux:  fuser -k 3000/tcp 3001/tcp 3002/tcp 3004/tcp 4001/tcp 4002/tcp 4003/tcp 4004/tcp\n");
  process.exit(1);
};

const server = createServer((req, res) => {
  const target = targetFor(req.url ?? "/");
  const proxy = httpRequest(
    new URL(target),
    {
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: new URL(target).host },
    },
    (upstream) => {
      res.writeHead(upstream.statusCode ?? 502, upstream.headers);
      upstream.pipe(res);
    },
  );
  proxy.on("error", () => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`502 — upstream unavailable: ${target}`);
  });
  req.pipe(proxy);
});

// Forward Next dev's HMR WebSocket (and any future upgrade) to the same target.
server.on("upgrade", (req, socket, head) => {
  const target = targetFor(req.url ?? "/");
  const upstream = net.connect(new URL(target).port, "127.0.0.1", () => {
    upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
});

const shutdown = () => {
  console.log("\nStopping single-origin dev server...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};

const bootstrap = async () => {
  await refuseIfPortsBusy();

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`\n[dev-web] single origin ready at http://localhost:${PORT}`);
    console.log(`[dev-web] dashboard: / :3004 · customers: /customers · invoices: /invoices`);
    console.log("[dev-web] API: /api/v1/{auth,users,customers,invoices,dashboard}/*\n");
  });

  // Ctrl-C / SIGTERM should take down the turbo dev fleet we started too.
  const turbo = spawn("pnpm", ["run", "dev:apps"], { stdio: "inherit" });
  const teardown = () => {
    turbo.kill("SIGINT");
    shutdown();
  };
  process.on("SIGINT", teardown);
  process.on("SIGTERM", teardown);
};

bootstrap();

