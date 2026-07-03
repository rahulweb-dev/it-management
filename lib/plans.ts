import type { Plan } from "@/lib/constants/enums"

/** Storage limit per plan, in GB. This is the single source of truth — the
 * limit is always computed from `company.plan`, never stored redundantly,
 * so upgrading/downgrading a plan takes effect immediately everywhere. */
export const PLAN_STORAGE_GB: Record<Plan, number> = {
  starter: 5,
  medium: 10,
  high: 20,
}

export const BYTES_PER_GB = 1024 * 1024 * 1024

export function planStorageLimitBytes(plan: Plan) {
  return PLAN_STORAGE_GB[plan] * BYTES_PER_GB
}

export function bytesToGb(bytes: number, decimals = 2) {
  return Number((bytes / BYTES_PER_GB).toFixed(decimals))
}
