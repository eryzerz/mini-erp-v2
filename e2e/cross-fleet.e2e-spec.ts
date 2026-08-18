import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { config as loadEnv } from "dotenv";
import request from "supertest";

loadEnv({ path: path.resolve(__dirname, "../.env"), quiet: true });

/**
 * Cross-fleet e2e (ticket 11): boot the entire local fleet as real processes
 * against per-service test databases and assert the boundary chain:
 *   login (auth) → list customers (customers) → create + send draft (invoices,
 *   exercising the customer-snapshot fetch over S2S) → dashboard reflects it.
 */
const PORTS = { auth: 4101, customers: 4102, invoices: 4103, dashboard: 4104 } as const;
const base = (port: number): string => `http://127.0.0.1:${port}`;
const ROOT = path.resolve(__dirname, "..");

interface Service {
  name: string;
  dir: string;
  dbEnv?: string;
  port: number;
}

const SERVICES: Service[] = [
  { name: "api-auth", dir: "apps/api-auth", dbEnv: "DATABASE_URL_AUTH", port: PORTS.auth },
  { name: "api-customers", dir: "apps/api-customers", dbEnv: "DATABASE_URL_CUSTOMERS", port: PORTS.customers },
  { name: "api-invoices", dir: "apps/api-invoices", dbEnv: "DATABASE_URL_INVOICES", port: PORTS.invoices },
  { name: "api-dashboard", dir: "apps/api-dashboard", port: PORTS.dashboard },
];

const testUrls: Record<string, string> = {
  DATABASE_URL_AUTH: process.env.DATABASE_URL_AUTH_TEST!,
  DATABASE_URL_CUSTOMERS: process.env.DATABASE_URL_CUSTOMERS_TEST!,
  DATABASE_URL_INVOICES: process.env.DATABASE_URL_INVOICES_TEST!,
};

for (const key of Object.keys(testUrls)) {
  if (!testUrls[key]) {
    throw new Error(
      `${key}_TEST is not set. Copy .env.example to .env so the cross-fleet e2e can target the slm_*_test databases.`,
    );
  }
}

const isPortFree = async (port: number): Promise<boolean> => {
  try {
    const res = await fetch(`${base(port)}/api/v1/health`, { signal: AbortSignal.timeout(1500) });
    return !res.ok;
  } catch {
    return true;
  }
};

describe("Cross-fleet e2e", () => {
  let procs: ChildProcess[] = [];
  const logs: string[] = [];
  let adminToken: string = "";
  let customerId: string = "";
  let customerName: string = "";
  let sentNumber: string = "";

  const record = (name: string) => (chunk: Buffer) => {
    logs.push(`[${name}] ${String(chunk).trimEnd()}`);
  };

  const spawnFleet = async (): Promise<void> => {
    // Fail fast if a fleet port is already claimed (a stale or dev instance):
    // otherwise the health poll can pass against the wrong process.
    const busy: string[] = [];
    for (const svc of SERVICES) {
      if (!(await isPortFree(svc.port))) {
        busy.push(`${svc.name}@${svc.port}`);
      }
    }
    if (busy.length > 0) {
      throw new Error(`Fleet ports already in use: ${busy.join(", ")}. Stop those processes first.`);
    }

    for (const svc of SERVICES) {
      const entry = path.resolve(ROOT, svc.dir, "dist/src/main.js");
      if (!existsSync(entry)) {
        throw new Error(`Missing build for ${svc.name} at ${entry}. Run "pnpm build" first.`);
      }
      const child = spawn(process.execPath, ["dist/src/main.js"], {
        cwd: path.resolve(ROOT, svc.dir),
        env: {
          ...process.env,
          PORT: String(svc.port),
          CUSTOMERS_SERVICE_URL: base(PORTS.customers),
          INVOICES_SERVICE_URL: base(PORTS.invoices),
          ...(svc.dbEnv ? { [svc.dbEnv]: testUrls[svc.dbEnv] } : {}),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout?.on("data", record(svc.name));
      child.stderr?.on("data", record(svc.name));
      procs.push(child);
    }

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const results = await Promise.all(
        SERVICES.map(async (svc) => {
          try {
            const res = await fetch(`${base(svc.port)}/api/v1/health`);
            return res.ok;
          } catch {
            return false;
          }
        }),
      );
      if (results.every(Boolean)) {
        return;
      }
      await sleep(500);
    }
    throw new Error(`Fleet did not become healthy.\n${logs.join("\n")}`);
  };

  const stopFleet = async (): Promise<void> => {
    for (const proc of procs) {
      if (proc.exitCode === null) {
        proc.kill("SIGTERM");
      }
    }
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline && procs.some((proc) => proc.exitCode === null)) {
      await sleep(100);
    }
    for (const proc of procs) {
      if (proc.exitCode === null) {
        proc.kill("SIGKILL");
      }
    }
  };

  beforeAll(async () => {
    await spawnFleet();
  });

  afterAll(async () => {
    await stopFleet();
  });

  it("logs in against auth and lists the seeded customers", async () => {
    const login = await request(base(PORTS.auth))
      .post("/api/v1/auth/login")
      .send({ email: "admin@slm.local", password: "admin123" })
      .expect(201);
    expect(login.body.accessToken).toBeDefined();
    adminToken = login.body.accessToken as string;

    const list = await request(base(PORTS.customers))
      .get("/api/v1/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    // Seed numbers: every service seed is deterministic (keyedId/mulberry32),
    // so the counts below are stable across runs unless a seed changes.
    expect(list.body.total).toBeGreaterThanOrEqual(12);
    customerId = list.body.items[0].id as string;
    customerName = list.body.items[0].name as string;
    expect(customerId).toBeTruthy();
  });

  it("creates and sends a draft (customer snapshot fetched over S2S)", async () => {
    const created = await request(base(PORTS.invoices))
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        customerId,
        dueDate: "2026-12-31",
        items: [
          { description: "Konsultasi lintas-layanan", quantity: "1.0000", unitPrice: "1500000.0000", taxRate: "11.00" },
        ],
      })
      .expect(201);
    expect(created.body.status).toBe("DRAFT");

    const sent = await request(base(PORTS.invoices))
      .post(`/api/v1/invoices/${created.body.id}/send`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(201);
    expect(sent.body.status).toBe("SENT");
    expect(sent.body.number).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(sent.body.customer?.name).toBe(customerName);
    // 1 line × 1,500,000 + 11% VAT = 1,665,000 (integer money math).
    expect(sent.body.total).toBe("1665000.00");
    sentNumber = sent.body.number as string;
  });

  it("the dashboard summary reflects the sent invoice", async () => {
    const summary = await request(base(PORTS.dashboard))
      .get("/api/v1/dashboard/summary")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(summary.body.revenue).toMatch(/^\d+\.\d{2}$/);
    expect(summary.body.outstanding).toMatch(/^\d+\.\d{2}$/);
    expect(summary.body.overdue).toMatch(/^\d+\.\d{2}$/);
    // 6 seeded SENT invoices + the one we just sent.
    expect(summary.body.countsByStatus.SENT).toBeGreaterThanOrEqual(7);
    const recents = summary.body.recentInvoices as { number: string; customer?: { name?: string } }[];
    const ours = recents.find((invoice) => invoice.number === sentNumber);
    expect(ours).toBeDefined();
    expect(ours!.customer?.name).toBe(customerName);
  });
});
