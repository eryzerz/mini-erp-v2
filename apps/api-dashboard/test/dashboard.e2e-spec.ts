import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import path from "node:path";

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { UserRole } from "@repo/contracts";
import { config as loadEnv } from "dotenv";
import request from "supertest";

import { AppModule } from "../src/app.module";

loadEnv({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

describe("Dashboard (e2e)", () => {
  let app: INestApplication;
  let jwt: JwtService;
  let fakeInvoices: Server;
  let receivedAuth: string | null = null;
  let receivedQuery: string | null = null;

  const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  const rawSummary = {
    revenue: 1234567.89,
    outstanding: 2500000,
    overdue: 450000,
    countsByStatus: { PAID: 4, SENT: 2 },
    recentInvoices: [
      {
        id: "inv-1",
        number: "INV-2026-0018",
        customerId: "11111111-1111-4111-8111-111111111111",
        customer: { id: "11111111-1111-4111-8111-111111111111", name: "PT Maju Jaya" },
        status: "PAID",
        issueDate: "2026-07-01",
        dueDate: "2026-07-15",
        paidAt: "2026-07-10T00:00:00.000Z",
        currency: "IDR",
        subtotal: "1234567.89",
        taxTotal: "0.00",
        total: "1234567.89",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-10T00:00:00.000Z",
        overdue: false,
      },
    ],
    monthlyRevenue: [{ month: "2026-07", revenue: 1234567.89 }],
  };

  beforeAll(async () => {
    // Stand-in for the invoices service's internal summary endpoint: enforces
    // the internal key + forwards-back the user JWT, and records what it got.
    fakeInvoices = createServer((req, res) => {
      if (req.headers["x-internal-key"] !== process.env.INTERNAL_API_KEY) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end("{}");
        return;
      }
      const token = req.headers["authorization"];
      receivedAuth = (Array.isArray(token) ? token[0] : token) ?? null;
      receivedQuery = new URL(req.url ?? "/", "http://localhost").search;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(rawSummary));
    });
    await new Promise<void>((resolve) => fakeInvoices.listen(0, "127.0.0.1", resolve));
    const port = (fakeInvoices.address() as AddressInfo).port;
    process.env.INVOICES_SERVICE_URL = `http://127.0.0.1:${port}`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
    await new Promise<void>((resolve) => fakeInvoices.close(() => resolve()));
  });

  it("rejects requests without a token", async () => {
    await request(app.getHttpServer()).get("/api/v1/dashboard/summary").expect(401);
  });

  it("returns an assembled summary and forwards the user JWT + internal key", async () => {
    const token = await jwt.signAsync({
      sub: "aa73da63-e26b-40a1-bb70-1c2b4c024870",
      email: "admin@slm.local",
      role: UserRole.ADMIN,
      companyId,
    });

    const res = await request(app.getHttpServer())
      .get("/api/v1/dashboard/summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(receivedAuth).toBe(`Bearer ${token}`);
    expect(res.body.revenue).toBe("1234567.89");
    expect(res.body.outstanding).toBe("2500000.00");
    expect(res.body.overdue).toBe("450000.00");
    expect(res.body.countsByStatus).toEqual({ DRAFT: 0, SENT: 2, PAID: 4, CANCELLED: 0 });
    expect(res.body.recentInvoices[0].customer.name).toBe("PT Maju Jaya");
    expect(res.body.monthlyRevenue).toEqual([{ month: "2026-07", revenue: "1234567.89" }]);
  });

  it("forwards the date window to the invoices service", async () => {
    const token = await jwt.signAsync({
      sub: "aa73da63-e26b-40a1-bb70-1c2b4c024870",
      email: "admin@slm.local",
      role: UserRole.ADMIN,
      companyId,
    });

    await request(app.getHttpServer())
      .get("/api/v1/dashboard/summary?from=2026-07-01&to=2026-07-31")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(receivedQuery).toContain("from=2026-07-01");
    expect(receivedQuery).toContain("to=2026-07-31");
  });

  it("rejects validation failures with 400", async () => {
    const token = await jwt.signAsync({
      sub: "aa73da63-e26b-40a1-bb70-1c2b4c024870",
      email: "admin@slm.local",
      role: UserRole.ADMIN,
      companyId,
    });

    await request(app.getHttpServer())
      .get("/api/v1/dashboard/summary?from=nope")
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });
});
