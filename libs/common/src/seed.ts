/**
 * Shared seed identity. The auth service owns the Company and User records;
 * the customers and invoices seeds reference them as logical cross-service ids
 * (each service owns its own database, no FKs). Keeping them here stops the
 * values drifting across the fleet's idempotent seeds.
 */
export const SEED_COMPANY_ID = "e940aab4-ef25-4a40-a980-125c32054645";
export const SEED_USER_ADMIN_ID = "aa73da63-e26b-40a1-bb70-1c2b4c024870";
export const SEED_USER_ACCOUNTANT_ID = "d17b0a2c-43ee-4c39-9e58-9b5e57e3f3b0";
