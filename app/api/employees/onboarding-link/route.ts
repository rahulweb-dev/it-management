import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { EmployeeInviteToken } from "@/models/EmployeeInviteToken"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { createInviteToken } from "@/lib/employee-invite"
import { writeAuditLog } from "@/lib/audit"

// Reusable, company-wide link — no email attached, never marked "used",
// so the same link works for every new hire until it expires. Longer TTL
// than a per-person invite since it's meant to be shared once and reused.
const LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

export async function POST(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const companyId = session.user.companyId!

    await connectDB()
    const { rawToken, tokenHash } = createInviteToken()
    const expiresAt = new Date(Date.now() + LINK_TTL_MS)

    const invite = await EmployeeInviteToken.create({
      companyId,
      email: null,
      tokenHash,
      expiresAt,
      createdBy: session.user.id,
    })

    const link = `${process.env.APP_BASE_URL}/employee-onboard/${rawToken}`

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "employee.onboarding_link_created",
      entityType: "EmployeeInviteToken",
      entityId: invite._id.toString(),
      request: req,
    })

    return NextResponse.json({ link, expiresAt })
  } catch (err) {
    return handleApiError(err)
  }
}
