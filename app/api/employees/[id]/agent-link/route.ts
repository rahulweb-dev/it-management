import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { User } from "@/models/User"
import { DeviceEnrollmentToken } from "@/models/DeviceEnrollmentToken"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { createEnrollmentToken } from "@/lib/agent/tokens"
import { sendMail } from "@/lib/mail"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    const companyId = session.user.companyId!

    await connectDB()
    const employee = await User.findOne({ _id: id, companyId, isActive: true })
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    if (!employee.branchId) {
      return NextResponse.json(
        { error: "This employee isn't assigned to a branch yet — add that first." },
        { status: 400 }
      )
    }

    const { rawToken, tokenHash, expiresAt } = createEnrollmentToken()
    await DeviceEnrollmentToken.create({
      companyId,
      employeeId: employee._id,
      branchId: employee.branchId,
      tokenHash,
      expiresAt,
      createdBy: session.user.id,
    })

    const link = `${process.env.APP_BASE_URL}/agent/install/${rawToken}`

    sendMail({
      companyId,
      to: employee.email,
      template: "agent-install-link",
      data: { name: employee.name, link },
    }).catch(() => {})

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "device.install_link_sent",
      entityType: "User",
      entityId: employee._id.toString(),
      request: req,
    })

    return NextResponse.json({ link, expiresAt })
  } catch (err) {
    return handleApiError(err)
  }
}
