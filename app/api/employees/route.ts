import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { User } from "@/models/User"
import { nextSequence, formatSequence } from "@/models/Counter"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { assertCompanyInOrganization } from "@/lib/organization"
import { sendMail } from "@/lib/mail"
import { employeeCreateSchema } from "@/lib/validations/employee"
import { writeAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    await connectDB()

    const url = new URL(req.url)
    const requestedCompanyId = url.searchParams.get("companyId")

    let companyId = session.user.companyId
    if (requestedCompanyId && requestedCompanyId !== session.user.companyId) {
      await assertCompanyInOrganization(session.user.organizationId, requestedCompanyId)
      companyId = requestedCompanyId
    }

    const filter: Record<string, any> = { companyId }

    const branchId = url.searchParams.get("branchId")
    if (branchId) filter.branchId = branchId

    const employees = await User.find(filter)
      .select("-passwordHash")
      .populate("branchId", "name")
      .sort({ name: 1 })

    return NextResponse.json({ items: employees })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const body = await req.json()
    const parsed = employeeCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { password, joiningDate, ...rest } = parsed.data

    await connectDB()
    const existing = await User.findOne({ email: rest.email }).setOptions({ skipTenantGuard: true })
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const companyId = session.user.companyId!
    const seq = await nextSequence(companyId, "employee")
    const employee = await User.create({
      ...rest,
      managerId: rest.managerId || null,
      joiningDate: joiningDate || null,
      passwordHash,
      companyId,
      employeeCode: formatSequence("EMP", seq),
    })

    sendMail({
      companyId: session.user.companyId!,
      to: employee.email,
      template: "welcome-new-employee",
      data: {
        name: employee.name,
        companyName: "your company",
        link: `${process.env.APP_BASE_URL}/login`,
      },
    }).catch(() => {})

    writeAuditLog({
      companyId: session.user.companyId!,
      userId: session.user.id,
      action: "employee.created",
      entityType: "User",
      entityId: employee._id.toString(),
      changes: { role: employee.role, email: employee.email },
      request: req,
    })

    const { passwordHash: _omit, ...safeEmployee } = employee.toObject()
    return NextResponse.json({ item: safeEmployee }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
