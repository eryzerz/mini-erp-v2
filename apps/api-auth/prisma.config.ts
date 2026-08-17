import path from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// The Prisma CLI is always run from the package dir (every script uses pnpm
// --filter), so cwd is apps/api-auth and the shared .env sits two levels up.
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL_AUTH!,
  },
});
