import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { User } from "@/models/User"
import { Branch } from "@/models/Branch"
import { EmployeeInviteToken } from "@/models/EmployeeInviteToken"
import { DeviceEnrollmentToken } from "@/models/DeviceEnrollmentToken"
import { employeeOnboardSchema } from "@/lib/validations/employee"
import { hashInviteToken } from "@/lib/employee-invite"
import { createEnrollmentToken } from "@/lib/agent/tokens"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { writeAuditLog } from "@/lib/audit"
import mongoose from "mongoose"
import { HttpError } from "@/lib/api"
import { assertCanAddEmployees } from "@/lib/plan-limits"

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const { allowed } = checkRateLimit(`employee-onboard:${ip}`, 20, 15 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = employeeOnboardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }
  const { token, employeeCode, name, password, phone, branchId, department } = parsed.data

  await connectDB()

  const invite = await EmployeeInviteToken.findOne({
    tokenHash: hashInviteToken(token),
    expiresAt: { $gt: new Date() },
  }).setOptions({ skipTenantGuard: true })

  if (!invite) {
    return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 400 })
  }

  // Per-person invites (email pre-attached) are single-use. Generic,
  // company-wide links (email null) are reusable by design — every new
  // hire uses the same link, so there's no "used" state to enforce.
  const isPerPersonInvite = !!invite.email
  if (isPerPersonInvite && invite.usedAt) {
    return NextResponse.json({ error: "This invite link has already been used." }, { status: 400 })
  }

  // The email is never trusted from the client when the link was issued
  // for a specific person — otherwise someone could reuse a colleague's
  // invite link to register under a different address.
  const email = isPerPersonInvite ? invite.email : parsed.data.email?.toLowerCase().trim()
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const companyId = invite.companyId.toString()

  const existingEmail = await User.findOne({ email }).setOptions({ skipTenantGuard: true })
  if (existingEmail) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
  }

  const existingCode = await User.findOne({ companyId, employeeCode })
  if (existingCode) {
    return NextResponse.json({ error: "That Employee ID is already in use" }, { status: 409 })
  }

  try {
    await assertCanAddEmployees(companyId)
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  const branch = mongoose.isValidObjectId(branchId) ? await Branch.findOne({ _id: branchId, companyId }) : null
  if (!branch) {
    return NextResponse.json({ error: "Select a valid branch" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const employee = await User.create({
    companyId,
    employeeCode,
    name,
    email,
    passwordHash,
    phone: phone || null,
    role: "employee",
    branchId,
    department: department || null,
    isActive: true,
  })

  if (isPerPersonInvite) {
    invite.usedAt = new Date()
    await invite.save()
  }

  // Chain straight into device registration — no separate "send install
  // link" step needed. The browser gets redirected to the install page
  // in the same session right after this call succeeds.
  const { rawToken: deviceToken, tokenHash: deviceTokenHash, expiresAt: deviceExpiresAt } =
    createEnrollmentToken()
  await DeviceEnrollmentToken.create({
    companyId,
    employeeId: employee._id,
    branchId,
    tokenHash: deviceTokenHash,
    expiresAt: deviceExpiresAt,
    createdBy: employee._id,
  })

  writeAuditLog({
    companyId,
    userId: employee._id.toString(),
    action: "employee.self_onboarded",
    entityType: "User",
    entityId: employee._id.toString(),
    changes: { branchId, department, employeeCode },
    request: req,
  })

  return NextResponse.json({
    ok: true,
    employeeCode: employee.employeeCode,
    deviceInstallToken: deviceToken,
  })
}
