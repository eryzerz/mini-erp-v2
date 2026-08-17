import { execSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import path from "node:path";

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { UserRole } from "@repo/contracts";
import { config as loadEnv } from "dotenv";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

describe("Invoices (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;
  let fakeCustomers: Server;

  const testUrl = process.env.DATABASE_URL_INVOICES_TEST!;
  const companyA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const companyB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const customerA = "11111111-1111-4111-8111-111111111111";
  const strangerCustomer = "99999999-9999-4999-8999-999999999999";
  const foreignCustomer = "22222222-2222-4222-8222-222222222222";

  // createdById is a UUID-typed logical ref into the auth service, so the
  // token subject must be a UUID (production auth users carry real UUID ids).
  const tokenFor = async (role: UserRole, companyId: string, sub = "aa73da63-e26b-40a1-bb70-1c2b4c024870"): Promise<string> =>
    jwt.signAsync({ sub, email: "user@slm.local", role, companyId });

  const draft = (customerId = customerA) => ({
    customerId,
    dueDate: "2026-09-15",
    items: [
      { description: "Konsultasi", quantity: "2.0000", unitPrice: "750000.0000", taxRate: "11.00" },
      { description: "Pelatihan", quantity: "1.0000", unitPrice: "3500000.0000", taxRate: "0.00" },
    ],
  });

  beforeAll(async () => {
    process.env.DATABASE_URL_INVOICES = testUrl;
    execSync(`DATABASE_URL_INVOICES=${testUrl} pnpm exec prisma migrate deploy`, { stdio: "pipe" });

    // Stand-in for the customers service's internal endpoint (ticket 06: the
    // invoices service snapshots a customer over S2S at SEND). Enforces the
    // internal key so the header wiring is exercised for real.
    fakeCustomers = createServer((req, res) => {
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (req.headers["x-internal-key"] !== process.env.INTERNAL_API_KEY) {
        send(401, {});
        return;
      }
      const url = new URL(req.url ?? "/", "http://localhost");
      const match = url.pathname.match(/^\/api\/v1\/internal\/customers\/([\w-]+)$/);
      if (!match) {
        send(404, {});
        return;
      }
      const id = match[1]!;
      const byId: Record<string, unknown> = {
        [customerA]: { id: customerA, name: "PT Maju Jaya", taxId: "01.234.567.8-901.000", companyId: companyA },
        [foreignCustomer]: { id: foreignCustomer, name: "UD Berkah Makmur", taxId: null, companyId: companyB },
      };
      send(byId[id] ? 200 : 404, byId[id] ?? {});
    });
    await new Promise<void>((resolve) => fakeCustomers.listen(0, "127.0.0.1", resolve));
    const port = (fakeCustomers.address() as AddressInfo).port;
    process.env.CUSTOMERS_SERVICE_URL = `http://127.0.0.1:${port}`;

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "InvoiceStatusChange", "InvoiceItem", "Invoice" CASCADE`);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await new Promise<void>((resolve) => fakeCustomers.close(() => resolve()));
  });

  it("rejects requests without a token", async () => {
    await request(app.getHttpServer()).get("/api/v1/invoices").expect(401);
  });

  it("creates a draft with computed totals and no number", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const res = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft())
      .expect(201);

    expect(res.body.status).toBe("DRAFT");
    expect(res.body.number).toBeNull();
    expect(res.body.customer).toBeUndefined();
    // 2×750000 = 1500000 + 11% = 165000 → subtotal 5000000 (2 lines), tax 165000, total 5165000
    expect(res.body.subtotal).toBe("5000000.00");
    expect(res.body.taxTotal).toBe("165000.00");
    expect(res.body.total).toBe("5165000.00");
  });

  it("lists invoices scoped to the caller's company with a status filter", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const created = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft())
      .expect(201);

    const all = await request(app.getHttpServer())
      .get("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(all.body.total).toBeGreaterThanOrEqual(2);
    expect(all.body.items.some((i: { id: string }) => i.id === created.body.id)).toBe(true);

    const drafts = await request(app.getHttpServer())
      .get("/api/v1/invoices?status=DRAFT")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(drafts.body.items.every((i: { status: string }) => i.status === "DRAFT")).toBe(true);

    const otherCompany = await request(app.getHttpServer())
      .get("/api/v1/invoices")
      .set("Authorization", `Bearer ${await tokenFor(UserRole.ADMIN, companyB)}`)
      .expect(200);
    expect(otherCompany.body.items.some((i: { id: string }) => i.id === created.body.id)).toBe(false);
  });

  it("gets an invoice with its items", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const created = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft())
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/invoices/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]!.lineTotal).toBe("1500000.00");
  });

  it("updates a draft's items and recomputes totals", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const created = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft())
      .expect(201);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/invoices/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ dueDate: "2026-12-31", items: [{ description: "Sewa", quantity: "1.0000", unitPrice: "4200000.0000", taxRate: "11.00" }] })
      .expect(200);
    expect(res.body.total).toBe("4662000.00");
  });

  it("sends a draft: snapshot fetched, number assigned, issue date set", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const created = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft())
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${created.body.id}/send`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    expect(res.body.status).toBe("SENT");
    expect(res.body.number).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(res.body.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.customer).toEqual({ id: customerA, name: "PT Maju Jaya" });

    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${created.body.id}/send`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);
  });

  it("rejects sending when the customer no longer exists", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const created = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft(strangerCustomer))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${created.body.id}/send`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });

  it("rejects sending an invoice for a customer of another company", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const created = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft(foreignCustomer))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${created.body.id}/send`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("marks a sent invoice paid", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const created = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft())
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${created.body.id}/send`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const paid = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${created.body.id}/mark-paid`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(paid.body.status).toBe("PAID");
    expect(paid.body.paidAt).not.toBeNull();
  });

  it("cancels a draft and rejects cancelling a paid invoice", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const draftCancel = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft())
      .expect(201);
    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${draftCancel.body.id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(cancelled.body.status).toBe("CANCELLED");

    const sentPaid = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft())
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${sentPaid.body.id}/send`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${sentPaid.body.id}/mark-paid`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${sentPaid.body.id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);
  });

  it("lets an admin delete a draft but not a sent invoice; denies accountants", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const adminToken = await tokenFor(UserRole.ADMIN, companyA);

    const draftDel = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft())
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/invoices/${draftDel.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/invoices/${draftDel.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const sentDel = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send(draft())
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${sentDel.body.id}/send`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/invoices/${sentDel.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409);
  });

  it("rejects validation failures with 400", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerId: "not-a-uuid", dueDate: "nope", items: [] })
      .expect(400);
  });
});
