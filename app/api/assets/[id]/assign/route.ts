import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { User } from "@/models/User"
import { AssetAssignmentHistory } from "@/models/AssetAssignmentHistory"
import { AssetInspection } from "@/models/AssetInspection"
import { Notification } from "@/models/Notification"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { getAccessibleCompanyIds } from "@/lib/organization"
import { assignAssetSchema } from "@/lib/validations/asset"
import { resolveProductType } from "@/lib/constants/product-types"
import {
  readInspectionRequest,
  validateInspection,
  uploadInspectionPhotos,
  checklistHasDamage,
} from "@/lib/inspection"
import { sendMail } from "@/lib/mail"
import { writeAuditLog } from "@/lib/audit"

const UNASSIGNABLE_STATUSES = ["in_repair", "disposed", "lost"]

// Hand-over ("check-out"): multipart request carrying the condition
// photos and damage checklist — see lib/inspection.ts for the format.
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
    const parsed = assignAssetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { userId, notes, inspection } = parsed.data
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    await connectDB()
    const companyIds = await getAccessibleCompanyIds(session)
    const asset = await Asset.findOne({ _id: id, companyId: { $in: companyIds } })
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    if (asset.assignedTo) {
      return NextResponse.json(
        { error: "Asset is already assigned — unassign it first" },
        { status: 409 }
      )
    }
    if (UNASSIGNABLE_STATUSES.includes(asset.status)) {
      return NextResponse.json(
        { error: `Asset is ${asset.status.replace("_", " ")} and can't be assigned.` },
        { status: 409 }
      )
    }
    const companyId = asset.companyId.toString()

    const employee = await User.findOne({ _id: userId, companyId, isActive: true })
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

    const productType = resolveProductType(asset)
    validateInspection(productType, inspection, photos)

    // Claim atomically — two IT people assigning the same asset at once
    // must not both succeed (the old check-then-save allowed that).
    const claimed = await Asset.findOneAndUpdate(
      { _id: asset._id, companyId, assignedTo: null, status: asset.status },
      {
        assignedTo: employee._id,
        status: "assigned",
        condition: inspection.overallCondition,
        productType,
      },
      { new: true }
    )
    if (!claimed) {
      return NextResponse.json({ error: "Asset was just assigned by someone else." }, { status: 409 })
    }

    let uploaded
    try {
      uploaded = await uploadInspectionPhotos({ photos, companyId, assetCode: asset.assetId, kind: "check_out" })
    } catch (err) {
      await Asset.updateOne(
        { _id: asset._id, companyId, assignedTo: employee._id },
        { assignedTo: null, status: asset.status, condition: asset.condition }
      )
      throw err
    }

    const history = await AssetAssignmentHistory.create({
      companyId,
      assetId: asset._id,
      toUserId: employee._id,
      branchId: asset.branchId,
      assignedDate: new Date(),
      assignedBy: session.user.id,
      condition: inspection.overallCondition,
      notes: notes || null,
    })

    const checkOut = await AssetInspection.create({
      companyId,
      assetId: asset._id,
      assignmentId: history._id,
      kind: "check_out",
      productType,
      employeeId: employee._id,
      performedBy: session.user.id,
      photos: uploaded,
      checklist: inspection.checklist.map((c) => ({ ...c, note: c.note || null })),
      overallCondition: inspection.overallCondition,
      hasDamage: checklistHasDamage(inspection.checklist),
      notes: inspection.notes || null,
    })
    history.checkOutInspectionId = checkOut._id
    await history.save()

    await Notification.create({
      companyId,
      userId: employee._id,
      type: "assignment",
      message: `${asset.assetName} (${asset.assetId}) has been assigned to you — please review its condition photos and confirm receipt`,
      link: "/assets",
    })

    sendMail({
      companyId,
      to: employee.email,
      template: "asset-assigned",
      data: {
        assetName: asset.assetName,
        assetId: asset.assetId,
        link: `${process.env.APP_BASE_URL}/assets`,
      },
    }).catch(() => {})

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "asset.assigned",
      entityType: "Asset",
      entityId: asset._id.toString(),
      changes: {
        toUserId: employee._id.toString(),
        inspectionId: checkOut._id.toString(),
        condition: inspection.overallCondition,
        photos: uploaded.length,
      },
      request: req,
    })

    return NextResponse.json({ item: claimed })
  } catch (err) {
    return handleApiError(err)
  }
}
