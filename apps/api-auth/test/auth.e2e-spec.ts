import { execSync } from "node:child_process";
import path from "node:path";

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { UserRole } from "@repo/contracts";
import { config as loadEnv } from "dotenv";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const testUrl = process.env.DATABASE_URL_AUTH_TEST!;
  const admin = { email: "e2e-admin@slm.local", password: "e2e-password", name: "E2E Admin" };

  beforeAll(async () => {
    // Point the app's PrismaService at the dedicated test database. prisma.config.ts
    // reads DATABASE_URL_AUTH from the env and dotenv never overrides an existing var.
    process.env.DATABASE_URL_AUTH = testUrl;
    execSync(`DATABASE_URL_AUTH=${testUrl} pnpm exec prisma migrate deploy`, { stdio: "pipe" });

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "RefreshToken", "User", "Company" CASCADE`);

    const company = await prisma.company.create({ data: { name: "E2E Company" } });
    await prisma.user.create({
      data: {
        companyId: company.id,
        email: admin.email,
        name: admin.name,
        role: UserRole.ADMIN,
        passwordHash: await hash(admin.password),
      },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("rejects a wrong password", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: admin.email, password: "wrong-password" })
      .expect(401);
  });

  it("logs in, reads /me, rotates a refresh token, and revokes on logout", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: admin.email, password: admin.password })
      .expect(201);

    const { accessToken, refreshToken, user } = login.body;
    expect(user.email).toBe(admin.email);
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();

    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => expect(res.body.email).toBe(admin.email));

    const rotated = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(201);
    expect(rotated.body.accessToken).toBeDefined();
    expect(rotated.body.refreshToken).toBeDefined();

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${rotated.body.accessToken}`)
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(201);

    // The rotated token was revoked by logout: reuse must fail.
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });

  it("rejects requests without a token", async () => {
    await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);
  });

  it("rejects validation failures with 400", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "not-an-email", password: "short" })
      .expect(400);
  });

  describe("users admin (RBAC)", () => {
    let adminAccessToken: string;
    let accountant: { email: string; password: string; name: string };

    beforeAll(async () => {
      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: admin.email, password: admin.password })
        .expect(201);
      adminAccessToken = login.body.accessToken as string;
    });

    it("allows an admin to list and create users", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          email: "e2e-accountant@slm.local",
          name: "E2E Accountant",
          password: "accountant-pass",
          role: UserRole.ACCOUNTANT,
        })
        .expect(201);
      expect(created.body.email).toBe("e2e-accountant@slm.local");

      accountant = {
        email: created.body.email,
        password: "accountant-pass",
        name: created.body.name,
      };

      const list = await request(app.getHttpServer())
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(list.body.total).toBe(2);
      expect(list.body.items.some((user: { email: string }) => user.email === accountant.email)).toBe(true);
    });

    it("forbids a non-admin from listing users", async () => {
      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: accountant.email, password: accountant.password })
        .expect(201);

      await request(app.getHttpServer())
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .expect(403);
    });

    it("refuses to delete your own account", async () => {
      const me = await prisma.user.findUniqueOrThrow({ where: { email: admin.email } });
      await request(app.getHttpServer())
        .delete(`/api/v1/users/${me.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });
  });
});
