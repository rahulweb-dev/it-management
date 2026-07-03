import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { AssetAssignmentHistory } from "@/models/AssetAssignmentHistory"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { getAccessibleCompanyIds } from "@/lib/organization"
import { unassignAssetSchema } from "@/lib/validations/asset"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = unassignAssetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { condition, notes } = parsed.data

    await connectDB()
    const companyIds = await getAccessibleCompanyIds(session)
    const asset = await Asset.findOne({ _id: id, companyId: { $in: companyIds } })
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    if (!asset.assignedTo) {
      return NextResponse.json({ error: "Asset isn't currently assigned" }, { status: 409 })
    }
    const companyId = asset.companyId.toString()
    const previousUserId = asset.assignedTo.toString()

    await AssetAssignmentHistory.updateOne(
      { companyId, assetId: asset._id, toUserId: asset.assignedTo, returnedDate: null },
      { returnedDate: new Date(), ...(notes && { notes }), ...(condition && { condition }) }
    )

    asset.assignedTo = null
    asset.status = "available"
    if (condition) asset.condition = condition
    await asset.save()

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "asset.unassigned",
      entityType: "Asset",
      entityId: asset._id.toString(),
      changes: { fromUserId: previousUserId },
      request: req,
    })

    return NextResponse.json({ item: asset })
  } catch (err) {
    return handleApiError(err)
  }
}
