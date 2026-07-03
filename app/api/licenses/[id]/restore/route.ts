import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { License } from "@/models/License"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    const companyId = session.user.companyId!

    await connectDB()
    const license = await License.findOne({ _id: id, companyId, deletedAt: { $ne: null } })
    if (!license) return NextResponse.json({ error: "Archived license not found" }, { status: 404 })

    await license.restore()

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "license.restored",
      entityType: "License",
      entityId: license._id.toString(),
      request: req,
    })

    return NextResponse.json({ item: license })
  } catch (err) {
    return handleApiError(err)
  }
}
