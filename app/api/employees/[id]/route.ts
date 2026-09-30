import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { User } from "@/models/User"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { employeeUpdateSchema } from "@/lib/validations/employee"
import { writeAuditLog } from "@/lib/audit"
import { assertBranchInCompany, assertUserInCompany } from "@/lib/tenant-refs"
import { assertCanAddEmployees } from "@/lib/plan-limits"
import { releaseEmployeeAssets } from "@/lib/offboarding"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    const { id } = await params
    // Employees may read only their own record; IT can read anyone in the company.
    if (session.user.role !== "it_person" && id !== session.user.id) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }
    await connectDB()
    const employee = await User.findOne({ _id: id, companyId: session.user.companyId })
      .select("-passwordHash -resetTokenHash -resetTokenExpiresAt")
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
    const companyId = session.user.companyId!

    await connectDB()
    await assertBranchInCompany(companyId, rest.branchId)
    await assertUserInCompany(companyId, managerId, "Manager")
    if (managerId && managerId === id) {
      return NextResponse.json({ error: "An employee can't be their own manager." }, { status: 400 })
    }
    if (id === session.user.id && (rest.isActive === false || (rest.role && rest.role !== "it_person"))) {
      return NextResponse.json({ error: "You can't deactivate or demote your own account." }, { status: 400 })
    }
    if (rest.isActive === true) {
      const current = await User.findOne({ _id: id, companyId })
      if (current && !current.isActive) await assertCanAddEmployees(companyId)
    }
    const employee = await User.findOneAndUpdate(
      { _id: id, companyId: session.user.companyId },
      {
        ...rest,
        ...(managerId !== undefined && { managerId: managerId || null }),
        ...(joiningDate !== undefined && { joiningDate: joiningDate || null }),
      },
      { new: true }
    ).select("-passwordHash -resetTokenHash -resetTokenExpiresAt")

    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

    // Offboarding: deactivating an employee forces their assets back to available.
    if (parsed.data.isActive === false) {
      await releaseEmployeeAssets(companyId, id, "deactivated")
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
    if (id === session.user.id) {
      return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 })
    }
    const companyId = session.user.companyId!
    const employee = await User.findOne({ _id: id, companyId })
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

    const releasedAssets = await releaseEmployeeAssets(companyId, id, "deleted")
    // The unique email index still covers soft-deleted users, so the
    // address would be locked forever. Move it aside (the original stays in
    // the audit log below) so the person can be re-invited later.
    const originalEmail = employee.email
    employee.email = `deleted-${employee._id}-${originalEmail}`
    employee.isActive = false
    await employee.save()
    await employee.softDelete()

    writeAuditLog({
      companyId: session.user.companyId!,
      userId: session.user.id,
      action: "employee.deleted",
      entityType: "User",
      entityId: employee._id.toString(),
      changes: { email: originalEmail, releasedAssets },
      request: req,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
