import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { User } from "@/models/User"
import { Asset } from "@/models/Asset"
import { AssetAssignmentHistory } from "@/models/AssetAssignmentHistory"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { employeeUpdateSchema } from "@/lib/validations/employee"
import { writeAuditLog } from "@/lib/audit"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    const { id } = await params
    await connectDB()
    const employee = await User.findOne({ _id: id, companyId: session.user.companyId })
      .select("-passwordHash")
      .populate("branchId", "name")
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    return NextResponse.json({ item: employee })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    const body = await req.json()
    const parsed = employeeUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { managerId, joiningDate, ...rest } = parsed.data

    await connectDB()
    const employee = await User.findOneAndUpdate(
      { _id: id, companyId: session.user.companyId },
      {
        ...rest,
        ...(managerId !== undefined && { managerId: managerId || null }),
        ...(joiningDate !== undefined && { joiningDate: joiningDate || null }),
      },
      { new: true }
    ).select("-passwordHash")

    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

    // Offboarding: deactivating an employee forces their assets back to available.
    if (parsed.data.isActive === false) {
      const assets = await Asset.find({ companyId: session.user.companyId, assignedTo: id })
      for (const asset of assets) {
        await AssetAssignmentHistory.updateOne(
          { companyId: session.user.companyId, assetId: asset._id, toUserId: id, returnedDate: null },
          { returnedDate: new Date() }
        )
        asset.assignedTo = null
        asset.status = "available"
        await asset.save()
      }
    }

    writeAuditLog({
      companyId: session.user.companyId!,
      userId: session.user.id,
      action: parsed.data.isActive === false ? "employee.deactivated" : "employee.updated",
      entityType: "User",
      entityId: employee._id.toString(),
      changes: rest,
      request: req,
    })

    return NextResponse.json({ item: employee })
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
    const employee = await User.findOne({ _id: id, companyId: session.user.companyId })
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

    await employee.softDelete()

    writeAuditLog({
      companyId: session.user.companyId!,
      userId: session.user.id,
      action: "employee.deleted",
      entityType: "User",
      entityId: employee._id.toString(),
      request: req,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
