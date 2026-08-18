"use client";

// Microfrontends-aware zone bases (ticket 07): each zone's canonical base is
// env-driven so one origin can host all three zones via Vercel edge path
// routing in production. The defaults keep local development working with each
// zone on its own port (dashboard 3000 / customers 3001 / invoices 3002).
export const ZONE_BASE = {
  dashboard: process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000",
  customers: process.env.NEXT_PUBLIC_CUSTOMERS_URL ?? "http://localhost:3001",
  invoices: process.env.NEXT_PUBLIC_INVOICES_URL ?? "http://localhost:3002",
} as const;

// The dashboard zone hosts the login page (ticket 07 — it is the entry point),
// so routes that need to sign a user in redirect there, not to a same-zone
// /login that only the dashboard zone serves.
export const DASHBOARD_LOGIN_URL = `${ZONE_BASE.dashboard}/login`;
