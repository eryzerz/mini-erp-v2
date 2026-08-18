import type { NextConfig } from "next";

// Local parity with the Vercel edge: /api/v1/{prefix}/* is proxied to the
// matching service port, so web-shared's same-origin requests reach the
// locally-running fleet exactly like the shared origin does in prod.
const localServices = {
  auth: "http://localhost:4001",
  customers: "http://localhost:4002",
  invoices: "http://localhost:4003",
  dashboard: "http://localhost:4004",
};

const nextConfig: NextConfig = {
  basePath: "/customers",
  // Every layer (this app, its vercel.json, and the dashboard's edge) uses
  // canonical no-trailing-slash URLs: trailingSlash:true here clashed with the
  // platform's default strip, producing an endless 308 ping-pong on the
  // dashboard origin. The bare /customers home redirects to /customers/list.
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
