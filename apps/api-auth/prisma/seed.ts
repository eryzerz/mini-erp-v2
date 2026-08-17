import path from "node:path";

import { hash } from "@node-rs/argon2";
import { config as loadEnv } from "dotenv";
import { UserRole } from "@repo/contracts";
import { SEED_COMPANY_ID, SEED_USER_ACCOUNTANT_ID, SEED_USER_ADMIN_ID } from "@repo/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_AUTH! }) });

async function main(): Promise<void> {
  await prisma.company.upsert({
    where: { id: SEED_COMPANY_ID },
    update: { name: "Sinergi Lintas Media" },
    create: { id: SEED_COMPANY_ID, name: "Sinergi Lintas Media" },
  });

  const users = [
    { id: SEED_USER_ADMIN_ID, email: "admin@slm.local", name: "Admin SLM", role: UserRole.ADMIN, password: "admin123" },
    { id: SEED_USER_ACCOUNTANT_ID, email: "accountant@slm.local", name: "Akuntan SLM", role: UserRole.ACCOUNTANT, password: "accountant123" },
  ];
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { name: user.name, role: user.role },
      create: {
        id: user.id,
        companyId: SEED_COMPANY_ID,
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: await hash(user.password),
      },
    });
  }

  console.log("Auth seed complete: 1 company, 2 users.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
