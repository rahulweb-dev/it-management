import type { LicenseStatus } from "@/lib/constants/enums"

/**
 * A license's status is never stored directly — it's always derived from
 * expiryDate/cancelled so it can never drift out of sync with the dates an
 * IT Person actually edits. Used both server-side (filtering the list) and
 * client-side (the status badge).
 */
export function licenseStatus(license: {
  expiryDate: string | Date
  reminderDaysBefore: number
  cancelled: boolean
}): LicenseStatus {
  if (license.cancelled) return "cancelled"

  const now = Date.now()
  const expiry = new Date(license.expiryDate).getTime()
  if (expiry < now) return "expired"

  const reminderWindowMs = license.reminderDaysBefore * 24 * 60 * 60 * 1000
  if (expiry - now <= reminderWindowMs) return "expiring_soon"

  return "active"
}
