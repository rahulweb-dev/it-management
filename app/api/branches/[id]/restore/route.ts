import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Branch } from "@/models/Branch"
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
    const branch = await Branch.findOne({ _id: id, companyId, deletedAt: { $ne: null } })
    if (!branch) return NextResponse.json({ error: "Archived branch not found" }, { status: 404 })

    await branch.restore()

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "branch.restored",
      entityType: "Branch",
      entityId: branch._id.toString(),
      request: req,
    })

    return NextResponse.json({ item: branch })
  } catch (err) {
    return handleApiError(err)
  }
}
