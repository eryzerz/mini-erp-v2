import type { NextConfig } from "next";

// Local parity with the Vercel edge (tickets 08/10): /api/v1/{prefix}/* is
// proxied to the matching service port, so web-shared's same-origin requests
// reach the locally-running fleet exactly like the shared origin does in prod.
const localServices = {
  auth: "http://localhost:4001",
  customers: "http://localhost:4002",
  invoices: "http://localhost:4003",
  dashboard: "http://localhost:4004",
};

const nextConfig: NextConfig = {
  transpilePackages: [
    "@repo/ui",
    "@repo/contracts",
    "@repo/common",
    "@repo/web-shared",
    "@repo/web-shell",
  ],
  async rewrites() {
    return Object.entries(localServices).map(([prefix, target]) => ({
      source: `/api/v1/${prefix}/:path*`,
      destination: `${target}/api/v1/${prefix}/:path*`,
    }));
  },
};

export default nextConfig;
