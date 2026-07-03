import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Company } from "@/models/Company"
import { requireSession, handleApiError } from "@/lib/api"
import { assertPlatformAdmin } from "@/lib/rbac"
import { writeAuditLog } from "@/lib/audit"
import { updateCompanySchema } from "@/lib/validations/platform"
import { getStorageStatus } from "@/lib/storage"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertPlatformAdmin(session)
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = updateCompanySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    await connectDB()
    const company = await Company.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { ...parsed.data },
      { new: true }
    )
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 })

    writeAuditLog({
      companyId: company._id.toString(),
      userId: session.user.id,
      action: "company.updated",
      entityType: "Company",
      entityId: company._id.toString(),
      changes: parsed.data,
      request: req,
    })

    const storage = await getStorageStatus(company._id.toString())
    return NextResponse.json({ item: { ...company.toObject(), storage } })
  } catch (err) {
    return handleApiError(err)
  }
}
