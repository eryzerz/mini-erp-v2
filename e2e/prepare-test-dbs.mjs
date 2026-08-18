/**
 * Migrate + seed the per-service TEST databases (ticket 06/11: the cross-fleet
 * e2e boots against slm_*_test). Reads the TEST URLs from the repo .env so they
 * have a single source of truth, then runs each service's db:prepare with the
 * test URL overriding its DATABASE_URL_*.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(path.join(ROOT, ".env"));

const services = [
  { name: "api-auth", env: "DATABASE_URL_AUTH" },
  { name: "api-customers", env: "DATABASE_URL_CUSTOMERS" },
  { name: "api-invoices", env: "DATABASE_URL_INVOICES" },
];

for (const service of services) {
  const testUrl = process.env[`${service.env}_TEST`];
  if (!testUrl) {
    throw new Error(
      `${service.env}_TEST is not set. Copy .env.example to .env and keep the slm_*_test URLs.`,
    );
  }
  execSync(`pnpm --filter @repo/${service.name} db:prepare`, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, [service.env]: testUrl },
  });
}

console.log("Test databases migrated and seeded.");
