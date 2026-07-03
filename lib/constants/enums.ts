/**
 * Enum-like constants shared between Mongoose schemas and client
 * components (dropdowns, badges, zod schemas). This file must never
 * import Mongoose — anything it imports gets bundled into the browser
 * the moment a "use client" component or a validation schema it shares
 * with one references a value (not just a type) from here.
 */

// Company-scoped roles — the only roles a User document can hold.
// "it_person" runs the company (branches, assets, tickets, staff);
// "employee" is self-service (own assets, own tickets).
export const COMPANY_ROLES = ["it_person", "employee"] as const
export type CompanyRole = (typeof COMPANY_ROLES)[number]

// Platform-level role — belongs to PlatformAdmin, not User, and has no
// companyId. Only a platform admin can create new companies.
export const PLATFORM_ROLE = "platform_admin" as const

export const ROLES = [PLATFORM_ROLE, ...COMPANY_ROLES] as const
export type Role = (typeof ROLES)[number]

// Plan names double as storage tiers — see lib/plans.ts for the GB limits.
export const PLANS = ["starter", "medium", "high"] as const
export type Plan = (typeof PLANS)[number]
export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled"] as const

export const ASSET_STATUSES = [
  "available",
  "assigned",
  "in_repair",
  "disposed",
  "lost",
] as const
export const ASSET_CONDITIONS = ["new", "good", "damaged", "needs_repair"] as const

export const MOVEMENT_STATUSES = ["pending", "approved", "rejected", "completed"] as const

export const ISSUE_TYPES = [
  "hardware",
  "software",
  "network",
  "printer",
  "email",
  "other",
] as const
export const PRIORITIES = ["low", "medium", "high", "critical"] as const
export type Priority = (typeof PRIORITIES)[number]
export const TICKET_STATUSES = [
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
] as const

export const NOTIFICATION_TYPES = ["warranty", "amc", "ticket", "assignment", "license"] as const

export const BILLING_CYCLES = ["one_time", "monthly", "yearly"] as const
export type BillingCycle = (typeof BILLING_CYCLES)[number]

export const LICENSE_STATUSES = ["active", "expiring_soon", "expired", "cancelled"] as const
export type LicenseStatus = (typeof LICENSE_STATUSES)[number]
