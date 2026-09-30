import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { User } from "@/models/User"
import { Company } from "@/models/Company"
import { EmployeeInviteToken } from "@/models/EmployeeInviteToken"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { employeeInviteSchema } from "@/lib/validations/employee"
import { createInviteToken } from "@/lib/employee-invite"
import { sendMail } from "@/lib/mail"
import { writeAuditLog } from "@/lib/audit"
import { assertCanAddEmployees } from "@/lib/plan-limits"

export async function POST(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const body = await req.json()
    const parsed = employeeInviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const email = parsed.data.email.toLowerCase().trim()
    const companyId = session.user.companyId!

    await connectDB()
    const existing = await User.findOne({ email }).setOptions({ skipTenantGuard: true })
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    await assertCanAddEmployees(companyId)

    const { rawToken, tokenHash, expiresAt } = createInviteToken()
    const invite = await EmployeeInviteToken.create({
      companyId,
      email,
      tokenHash,
      expiresAt,
      createdBy: session.user.id,
    })

    const company = await Company.findById(companyId)
    const link = `${process.env.APP_BASE_URL}/employee-onboard/${rawToken}`

    sendMail({
      companyId,
      to: email,
      template: "employee-invite",
      data: { companyName: company?.name ?? "your company", link },
    }).catch(() => {})

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "employee.invited",
      entityType: "EmployeeInviteToken",
      entityId: invite._id.toString(),
      changes: { email },
      request: req,
    })

    return NextResponse.json({ link, expiresAt })
  } catch (err) {
    return handleApiError(err)
  }
}
