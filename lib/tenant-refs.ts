import mongoose from "mongoose"
import { HttpError } from "@/lib/api"
import { Branch } from "@/models/Branch"
import { User } from "@/models/User"
import { Asset } from "@/models/Asset"

/**
 * Client-supplied reference ids (branchId, managerId, assignedTo...) must
 * point at documents in the *same* company before they're stored —
 * otherwise populate() on read (which looks up by bare _id, see
 * lib/mongoose/tenantPlugin.ts) would happily return another tenant's
 * names and emails. Empty/null values pass through: they mean "unset".
 */

function assertId(id: string, what: string) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(`${what} not found.`)
}

export async function assertBranchInCompany(companyId: string, branchId: string | null | undefined) {
  if (!branchId) return
  assertId(branchId, "Branch")
  const exists = await Branch.exists({ _id: branchId, companyId })
  if (!exists) throw new HttpError("Branch not found.")
}

export async function assertUserInCompany(
  companyId: string,
  userId: string | null | undefined,
  what = "User",
  { activeOnly = false } = {}
) {
  if (!userId) return
  assertId(userId, what)
  const exists = await User.exists({ _id: userId, companyId, ...(activeOnly && { isActive: true }) })
  if (!exists) throw new HttpError(`${what} not found.`)
}

/** For employees, the asset must also be one assigned to them. */
export async function assertAssetInScope(
  companyId: string,
  assetId: string | null | undefined,
  assignedTo?: string
) {
  if (!assetId) return
  assertId(assetId, "Asset")
  const exists = await Asset.exists({ _id: assetId, companyId, ...(assignedTo && { assignedTo }) })
  if (!exists) throw new HttpError("Asset not found.")
}
