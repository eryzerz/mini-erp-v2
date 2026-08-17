import path from "node:path";

import { hash } from "@node-rs/argon2";
import { config as loadEnv } from "dotenv";
import { UserRole } from "@repo/contracts";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_AUTH! }) });

async function main(): Promise<void> {
  await prisma.company.upsert({
    where: { id: "e940aab4-ef25-4a40-a980-125c32054645" },
    update: { name: "Sinergi Lintas Media" },
    create: { id: "e940aab4-ef25-4a40-a980-125c32054645", name: "Sinergi Lintas Media" },
  });

  const users = [
    { id: "aa73da63-e26b-40a1-bb70-1c2b4c024870", email: "admin@slm.local", name: "Admin SLM", role: UserRole.ADMIN, password: "admin123" },
    { id: "d17b0a2c-43ee-4c39-9e58-9b5e57e3f3b0", email: "accountant@slm.local", name: "Akuntan SLM", role: UserRole.ACCOUNTANT, password: "accountant123" },
  ];
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { name: user.name, role: user.role },
      create: {
        id: user.id,
        companyId: "e940aab4-ef25-4a40-a980-125c32054645",
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
