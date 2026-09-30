import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { User } from "@/models/User"
import { PlatformAdmin } from "@/models/PlatformAdmin"
import { requireSession, handleApiError } from "@/lib/api"
import { changePasswordSchema } from "@/lib/validations/profile"

export async function POST(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    const body = await req.json()
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { currentPassword, newPassword } = parsed.data

    await connectDB()
    const account = await (session.user.role === "platform_admin"
      ? PlatformAdmin.findById(session.user.id)
      : User.findOne({ _id: session.user.id, companyId: session.user.companyId }))

    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 })

    const valid = await bcrypt.compare(currentPassword, account.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
    }

    account.passwordHash = await bcrypt.hash(newPassword, 12)
    account.passwordChangedAt = new Date()
    await account.save()

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
