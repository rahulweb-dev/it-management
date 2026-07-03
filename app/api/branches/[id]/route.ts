import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Branch } from "@/models/Branch"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { branchSchema } from "@/lib/validations/branch"
import { writeAuditLog } from "@/lib/audit"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    const body = await req.json()
    const parsed = branchSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    await connectDB()
    const branch = await Branch.findOneAndUpdate(
      { _id: id, companyId: session.user.companyId },
      { ...parsed.data, managerId: parsed.data.managerId || null },
      { new: true }
    )
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

    writeAuditLog({
      companyId: session.user.companyId!,
      userId: session.user.id,
      action: "branch.updated",
      entityType: "Branch",
      entityId: branch._id.toString(),
      changes: parsed.data,
      request: req,
    })

    return NextResponse.json({ item: branch })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params

    await connectDB()
    const branch = await Branch.findOne({ _id: id, companyId: session.user.companyId })
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 })

    await branch.softDelete()

    writeAuditLog({
      companyId: session.user.companyId!,
      userId: session.user.id,
      action: "branch.deleted",
      entityType: "Branch",
      entityId: branch._id.toString(),
      request: req,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
