import { connectDB } from "@/lib/db"
import { Company } from "@/models/Company"
import { planStorageLimitBytes, bytesToGb } from "@/lib/plans"
import type { Plan } from "@/lib/constants/enums"

export class StorageLimitError extends Error {
  status = 413
}

export async function getStorageStatus(companyId: string) {
  // Called from Promise.all alongside other DB calls (e.g. the dashboard
  // page) — can't rely on one of those siblings having already triggered
  // the connection first, so this always awaits it itself.
  await connectDB()
  const company = await Company.findById(companyId)
  if (!company) throw new Error("Company not found")

  const limitBytes = planStorageLimitBytes(company.plan as Plan)
  const usedBytes = company.storageUsedBytes ?? 0
  const remainingBytes = Math.max(0, limitBytes - usedBytes)

  return {
    plan: company.plan as Plan,
    usedBytes,
    limitBytes,
    remainingBytes,
    percentUsed: limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0,
    usedGb: bytesToGb(usedBytes),
    limitGb: bytesToGb(limitBytes, 0),
    remainingGb: bytesToGb(remainingBytes),
  }
}

/** Throws StorageLimitError if this upload would push the company over its plan's limit. */
export async function assertStorageAvailable(companyId: string, additionalBytes: number) {
  const status = await getStorageStatus(companyId)
  if (status.usedBytes + additionalBytes > status.limitBytes) {
    throw new StorageLimitError(
      `Storage limit reached. Your ${status.plan} plan includes ${status.limitGb} GB — ` +
        `you have ${status.remainingGb} GB left. Upgrade your plan or free up space to continue.`
    )
  }
}

/** Call after a successful upload (positive delta) or delete (negative delta). */
export async function recordStorageUsage(companyId: string, deltaBytes: number) {
  await connectDB()
  await Company.updateOne({ _id: companyId }, { $inc: { storageUsedBytes: deltaBytes } })
  // Storage should never go negative (e.g. double-delete) — clamp it back to 0 if it did.
  await Company.updateOne(
    { _id: companyId, storageUsedBytes: { $lt: 0 } },
    { storageUsedBytes: 0 }
  )
}
