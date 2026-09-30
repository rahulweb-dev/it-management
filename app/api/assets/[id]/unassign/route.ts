import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { AssetAssignmentHistory } from "@/models/AssetAssignmentHistory"
import { AssetInspection } from "@/models/AssetInspection"
import { Notification } from "@/models/Notification"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { getAccessibleCompanyIds } from "@/lib/organization"
import { unassignAssetSchema } from "@/lib/validations/asset"
import { CHECK_ITEMS, resolveProductType, type CheckItem } from "@/lib/constants/product-types"
import {
  readInspectionRequest,
  validateInspection,
  uploadInspectionPhotos,
  checklistHasDamage,
  diffNewDamage,
} from "@/lib/inspection"
import { writeAuditLog } from "@/lib/audit"

// Return ("check-in"): same multipart format as assign. The checklist is
// compared against the hand-over inspection so damage that happened
// during this assignment is flagged as `newDamage`.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    }
    const { body, photos } = await readInspectionRequest(req)
    const parsed = unassignAssetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { notes, inspection, sendToRepair } = parsed.data

    await connectDB()
    const companyIds = await getAccessibleCompanyIds(session)
    const asset = await Asset.findOne({ _id: id, companyId: { $in: companyIds } })
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    if (!asset.assignedTo) {
      return NextResponse.json({ error: "Asset isn't currently assigned" }, { status: 409 })
    }
    const companyId = asset.companyId.toString()
    const previousUserId = asset.assignedTo

    const productType = resolveProductType(asset)
    validateInspection(productType, inspection, photos)

    const openAssignment = await AssetAssignmentHistory.findOne({
      companyId,
      assetId: asset._id,
      toUserId: previousUserId,
      returnedDate: null,
    }).sort({ assignedDate: -1 })
    const checkOut = openAssignment?.checkOutInspectionId
      ? await AssetInspection.findOne({ _id: openAssignment.checkOutInspectionId, companyId })
      : null
    const newDamage = diffNewDamage(checkOut?.checklist ?? null, inspection.checklist)
    const hasDamage = checklistHasDamage(inspection.checklist)

    const released = await Asset.findOneAndUpdate(
      { _id: asset._id, companyId, assignedTo: previousUserId },
      {
        assignedTo: null,
        status: sendToRepair ? "in_repair" : "available",
        condition: inspection.overallCondition,
        productType,
      },
      { new: true }
    )
    if (!released) {
      return NextResponse.json({ error: "Asset was just returned by someone else." }, { status: 409 })
    }

    let uploaded
    try {
      uploaded = await uploadInspectionPhotos({ photos, companyId, assetCode: asset.assetId, kind: "check_in" })
    } catch (err) {
      await Asset.updateOne(
        { _id: asset._id, companyId, assignedTo: null },
        { assignedTo: previousUserId, status: asset.status, condition: asset.condition }
      )
      throw err
    }

    const checkIn = await AssetInspection.create({
      companyId,
      assetId: asset._id,
      assignmentId: openAssignment?._id ?? null,
      kind: "check_in",
      productType,
      employeeId: previousUserId,
      performedBy: session.user.id,
      photos: uploaded,
      checklist: inspection.checklist.map((c) => ({ ...c, note: c.note || null })),
      overallCondition: inspection.overallCondition,
      hasDamage,
      newDamage,
      repairCostEstimate: inspection.repairCostEstimate ?? null,
      chargeToEmployee: Boolean(inspection.chargeToEmployee && newDamage.length > 0),
      notes: inspection.notes || null,
    })

    // Close every open row for this asset, not just one — older data can
    // have duplicates from the pre-atomic assign race.
    await AssetAssignmentHistory.updateMany(
      { companyId, assetId: asset._id, returnedDate: null },
      {
        returnedDate: new Date(),
        condition: inspection.overallCondition,
        checkInInspectionId: checkIn._id,
        ...(notes && { notes }),
      }
    )

    if (newDamage.length > 0) {
      const parts = newDamage.map((i) => CHECK_ITEMS[i as CheckItem] ?? i).join(", ")
      await Notification.create({
        companyId,
        userId: previousUserId,
        type: "assignment",
        message: checkIn.chargeToEmployee
          ? `Damage recorded when you returned ${asset.assetName} (${asset.assetId}): ${parts}. IT may contact you about repair costs.`
          : `Damage recorded when you returned ${asset.assetName} (${asset.assetId}): ${parts}.`,
        link: "/assets",
      })
    }

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "asset.unassigned",
      entityType: "Asset",
      entityId: asset._id.toString(),
      changes: {
        fromUserId: previousUserId.toString(),
        inspectionId: checkIn._id.toString(),
        condition: inspection.overallCondition,
        newDamage,
        sendToRepair: Boolean(sendToRepair),
      },
      request: req,
    })

    return NextResponse.json({ item: released, inspection: checkIn })
  } catch (err) {
    return handleApiError(err)
  }
}
