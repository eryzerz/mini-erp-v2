"use client";

// Microfrontends-aware zone bases: each zone's canonical base is env-driven so
// one origin can host all three zones via Vercel edge path routing in
// production. The defaults are single-origin paths, which is also how local
// single-origin dev works (scripts/dev-web.mjs serves every zone behind one
// origin on :3000, so the shared sessionStorage handoff holds).
export const ZONE_BASE = {
  dashboard: process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "/",
  customers: process.env.NEXT_PUBLIC_CUSTOMERS_URL ?? "/customers",
  invoices: process.env.NEXT_PUBLIC_INVOICES_URL ?? "/invoices",
} as const;

// The dashboard zone hosts the login page (it is the entry point), so routes
// that need to sign a user in redirect there, not to a same-zone /login that
// only the dashboard zone serves.
export const DASHBOARD_LOGIN_URL = `${ZONE_BASE.dashboard.replace(/\/$/, "")}/login`;
