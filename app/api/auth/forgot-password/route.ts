import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { User } from "@/models/User"
import { forgotPasswordSchema } from "@/lib/validations/auth"
import { createResetToken } from "@/lib/password-reset"
import { sendMail } from "@/lib/mail"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

// Always returns the same generic response whether or not the email
// exists — telling the caller "no account with that email" would let an
// attacker enumerate valid accounts. A fresh response is built each call
// rather than shared, since Response objects shouldn't be reused.
function genericResponse() {
  return NextResponse.json({
    message: "If an account exists for that email, a reset link has been sent.",
  })
}

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const { allowed } = checkRateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000)
  if (!allowed) return genericResponse()

  const body = await req.json().catch(() => ({}))
  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) return genericResponse()

  const email = parsed.data.email.toLowerCase().trim()

  try {
    await connectDB()
    const user = await User.findOne({ email, deletedAt: null, isActive: true }).setOptions({
      skipTenantGuard: true,
    })

    if (user) {
      const { rawToken, tokenHash, expiresAt } = createResetToken()
      user.resetTokenHash = tokenHash
      user.resetTokenExpiresAt = expiresAt
      await user.save()

      const link = `${process.env.APP_BASE_URL}/reset-password?email=${encodeURIComponent(email)}&token=${rawToken}`
      sendMail({
        companyId: user.companyId.toString(),
        to: user.email,
        template: "password-reset",
        data: { link },
      }).catch(() => {})
    }
  } catch (err) {
    console.error("forgot-password failed", err)
  }

  return genericResponse()
}
