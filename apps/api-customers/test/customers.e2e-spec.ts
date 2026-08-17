import { execSync } from "node:child_process";
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

describe("Customers (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const testUrl = process.env.DATABASE_URL_CUSTOMERS_TEST!;
  const companyA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const companyB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  const tokenFor = async (role: UserRole, companyId: string, sub = "test-subject"): Promise<string> =>
    jwt.signAsync({ sub, email: "user@slm.local", role, companyId });

  beforeAll(async () => {
    // Point the app's PrismaService at the dedicated test database. prisma.config.ts
    // reads DATABASE_URL_CUSTOMERS from the env and dotenv never overrides an existing var.
    process.env.DATABASE_URL_CUSTOMERS = testUrl;
    execSync(`DATABASE_URL_CUSTOMERS=${testUrl} pnpm exec prisma migrate deploy`, { stdio: "pipe" });

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Customer" CASCADE`);

    await prisma.customer.createMany({
      data: [
        { id: "11111111-1111-4111-8111-111111111111", companyId: companyA, name: "PT Maju Jaya", email: "hello@majujaya.co.id", phone: "+62 21 555 0134", taxId: "01.234.567.8-901.000" },
        { id: "22222222-2222-4222-8222-222222222222", companyId: companyA, name: "CV Sentosa Abadi", email: null, phone: null, taxId: null },
        { id: "33333333-3333-4333-8333-333333333333", companyId: companyB, name: "UD Berkah Makmur", email: null, phone: null, taxId: null },
      ],
    });

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
  });

  it("rejects requests without a token", async () => {
    await request(app.getHttpServer()).get("/api/v1/customers").expect(401);
  });

  it("lists customers scoped to the caller's company", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const res = await request(app.getHttpServer())
      .get("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((c: { name: string }) => c.name).sort()).toEqual([
      "CV Sentosa Abadi",
      "PT Maju Jaya",
    ]);
  });

  it("isolates customers across companies", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyB);
    await request(app.getHttpServer())
      .get("/api/v1/customers/11111111-1111-4111-8111-111111111111")
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });

  it("creates, normalizes, and fetches a customer", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    const created = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "PT Baru",
        email: "baru@example.co.id",
        phone: "+62 8123456 7890",
        taxId: "09.123.456.7-890.000",
        address: "Jl. Baru 1",
      })
      .expect(201);
    expect(created.body.name).toBe("PT Baru");
    expect(created.body.phone).toMatch(/^\+\d{2} \d{2,3}/);

    await request(app.getHttpServer())
      .get(`/api/v1/customers/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect((res) => expect(res.body.email).toBe("baru@example.co.id"));
  });

  it("updates a customer with PATCH semantics (omitted fields preserved)", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    await request(app.getHttpServer())
      .patch("/api/v1/customers/11111111-1111-4111-8111-111111111111")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "PT Maju Jaya (Baru)" })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe("PT Maju Jaya (Baru)");
        expect(res.body.email).toBe("hello@majujaya.co.id");
        expect(res.body.taxId).toBe("01.234.567.8-901.000");
        expect(res.body.phone).toBe("+62 21 555 0134");
      });
  });

  it("allows an admin to delete a customer, but forbids an accountant", async () => {
    const accountantToken = await tokenFor(UserRole.ACCOUNTANT, companyA);
    await request(app.getHttpServer())
      .delete("/api/v1/customers/22222222-2222-4222-8222-222222222222")
      .set("Authorization", `Bearer ${accountantToken}`)
      .expect(403);

    const adminToken = await tokenFor(UserRole.ADMIN, companyA);
    await request(app.getHttpServer())
      .delete("/api/v1/customers/22222222-2222-4222-8222-222222222222")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/customers/22222222-2222-4222-8222-222222222222")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
  });

  it("rejects validation failures with 400", async () => {
    const token = await tokenFor(UserRole.ACCOUNTANT, companyA);
    await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X", email: "not-an-email", phone: "abc" })
      .expect(400);
  });
});
