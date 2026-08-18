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
  basePath: "/invoices",
  // The dashboard project's edge rewrites route this zone by path prefix and
  // forward the bare home as "/invoices/" (an empty :path* capture). A
  // trailing-slash canonical home is what makes that hop a clean 200 instead
  // of a 308 redirect loop, and client-side navigations to the home then get a
  // valid RSC response instead of falling back to a full page load.
  trailingSlash: true,
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
