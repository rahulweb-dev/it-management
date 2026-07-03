import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { getAccessibleCompanyIds } from "@/lib/organization"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params

    await connectDB()
    const companyIds = await getAccessibleCompanyIds(session)
    const asset = await Asset.findOne({ _id: id, companyId: { $in: companyIds }, deletedAt: { $ne: null } })
    if (!asset) return NextResponse.json({ error: "Archived asset not found" }, { status: 404 })

    await asset.restore()

    writeAuditLog({
      companyId: asset.companyId.toString(),
      userId: session.user.id,
      action: "asset.restored",
      entityType: "Asset",
      entityId: asset._id.toString(),
      request: req,
    })

    return NextResponse.json({ item: asset })
  } catch (err) {
    return handleApiError(err)
  }
}
