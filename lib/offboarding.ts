import { Asset } from "@/models/Asset"
import { AssetAssignmentHistory } from "@/models/AssetAssignmentHistory"

/**
 * Takes every asset off an employee who is being deactivated or deleted,
 * so nothing stays stuck "assigned" to someone who can no longer log in
 * (a deleted user is hidden by populate(), which made such assets look
 * unassigned while still refusing reassignment). No return inspection is
 * possible here, so the history row says so — IT should inspect the
 * devices when they physically come back.
 */
export async function releaseEmployeeAssets(companyId: string, userId: string, reason: "deactivated" | "deleted") {
  const assets = await Asset.find({ companyId, assignedTo: userId })
  const now = new Date()
  for (const asset of assets) {
    await AssetAssignmentHistory.updateMany(
      { companyId, assetId: asset._id, returnedDate: null },
      { returnedDate: now, notes: `Released automatically — employee ${reason}. No return inspection recorded.` }
    )
    asset.assignedTo = null
    asset.status = "available"
    await asset.save()
  }
  return assets.length
}
