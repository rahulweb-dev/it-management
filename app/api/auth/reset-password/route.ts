import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { User } from "@/models/User"
import { resetPasswordSchema } from "@/lib/validations/auth"
import { hashResetToken } from "@/lib/password-reset"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const { allowed } = checkRateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }
  const { email, token, password } = parsed.data
  const tokenHash = hashResetToken(token)

  await connectDB()
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    resetTokenHash: tokenHash,
    resetTokenExpiresAt: { $gt: new Date() },
    deletedAt: null,
  }).setOptions({ skipTenantGuard: true })

  if (!user) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 })
  }

  user.passwordHash = await bcrypt.hash(password, 12)
  user.resetTokenHash = null
  user.resetTokenExpiresAt = null
  await user.save()

  return NextResponse.json({ ok: true })
}
