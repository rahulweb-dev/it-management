import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { AssetAssignmentHistory } from "@/models/AssetAssignmentHistory"
import { requireSession, handleApiError } from "@/lib/api"
import { getScopedFilter } from "@/lib/rbac"
import { getAccessibleCompanyIds } from "@/lib/organization"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    const { id } = await params
    await connectDB()

    // Confirm the caller can actually see this asset before returning its history.
    const asset =
      session.user.role === "it_person"
        ? await Asset.findOne({ _id: id, companyId: { $in: await getAccessibleCompanyIds(session) } })
        : await Asset.findOne({ ...getScopedFilter(session), _id: id })
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 })

    const items = await AssetAssignmentHistory.find({
      companyId: asset.companyId,
      assetId: id,
    })
      .populate("toUserId", "name email")
      .populate("fromUserId", "name email")
      .populate("assignedBy", "name email")
      .sort({ assignedDate: -1 })

    return NextResponse.json({ items })
  } catch (err) {
    return handleApiError(err)
  }
}
