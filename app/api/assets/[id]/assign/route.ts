import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { User } from "@/models/User"
import { AssetAssignmentHistory } from "@/models/AssetAssignmentHistory"
import { Notification } from "@/models/Notification"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { getAccessibleCompanyIds } from "@/lib/organization"
import { assignAssetSchema } from "@/lib/validations/asset"
import { sendMail } from "@/lib/mail"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    const body = await req.json()
    const parsed = assignAssetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { userId, notes } = parsed.data

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
    const companyId = asset.companyId.toString()

    const employee = await User.findOne({ _id: userId, companyId, isActive: true })
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

    asset.assignedTo = employee._id
    asset.status = "assigned"
    await asset.save()

    await AssetAssignmentHistory.create({
      companyId,
      assetId: asset._id,
      toUserId: employee._id,
      branchId: asset.branchId,
      assignedDate: new Date(),
      assignedBy: session.user.id,
      notes: notes || null,
    })

    await Notification.create({
      companyId,
      userId: employee._id,
      type: "assignment",
      message: `${asset.assetName} (${asset.assetId}) has been assigned to you`,
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
      changes: { toUserId: employee._id.toString() },
      request: req,
    })

    return NextResponse.json({ item: asset })
  } catch (err) {
    return handleApiError(err)
  }
}
