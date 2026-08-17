/**
 * Shared seed identity. The auth service owns the Company record; the
 * customers (and later invoices) seeds reference it as a logical cross-service
 * id (wayfinder ticket 06: per-service DBs, logical refs, no FKs). Keeping it
 * here stops the value drifting across the fleet's idempotent seeds.
 */
export const SEED_COMPANY_ID = "e940aab4-ef25-4a40-a980-125c32054645";
