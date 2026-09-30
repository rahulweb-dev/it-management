import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { User } from "@/models/User"
import { PlatformAdmin } from "@/models/PlatformAdmin"
import { Company } from "@/models/Company"
import { authConfig, type AppJWT } from "@/auth.config"
import type { Role } from "@/lib/constants/enums"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      companyId: string | null
      branchId: string | null
      organizationId: string | null
      role: Role
      name: string
      email: string
      avatar: string | null
    }
  }
}

/** Surfaces to the login form as result.code, so it can say why. */
class InactiveCompanyError extends CredentialsSignin {
  code = "inactive_company"
}

function companyIsUsable(company: { deletedAt?: Date | null; subscriptionStatus?: string } | null) {
  return !!company && !company.deletedAt && company.subscriptionStatus !== "canceled"
}

const RECHECK_INTERVAL_MS = 60 * 1000

/**
 * A JWT is otherwise frozen at sign-in: a deactivated, deleted or demoted
 * user, a cancelled company, or a password reset would all leave existing
 * sessions working for their whole lifetime. So at most once a minute,
 * reload the account and its company and either refresh the claims or
 * return null, which ends the session. Runs wherever auth() runs on the
 * Node runtime (every API route and server page); edge middleware only
 * reads the token for routing and never grants data access on its own.
 */
async function revalidateToken(t: AppJWT): Promise<AppJWT | null> {
  const now = Date.now()
  if (t.checkedAt && now - t.checkedAt < RECHECK_INTERVAL_MS) return t
  // Tokens issued before this check existed carry no loginAt; treat
  // them as issued at the epoch so any recorded password change ends them.
  const loginAt = t.loginAt ?? 0
  const changedAfterLogin = (d?: Date | null) => !!d && d.getTime() > loginAt

  try {
    await connectDB()
    if (t.role === "platform_admin") {
      const admin = await PlatformAdmin.findById(t.id)
      if (!admin || !admin.isActive || changedAfterLogin(admin.passwordChangedAt)) return null
      return { ...t, loginAt, checkedAt: now }
    }

    const user = await User.findOne({ _id: t.id, deletedAt: null }).setOptions({ skipTenantGuard: true })
    if (!user || !user.isActive || changedAfterLogin(user.passwordChangedAt)) return null
    const company = await Company.findOne({ _id: user.companyId }).setOptions({ skipTenantGuard: true })
    if (!companyIsUsable(company)) return null

    return {
      ...t,
      role: user.role,
      companyId: user.companyId.toString(),
      branchId: user.branchId ? user.branchId.toString() : null,
      organizationId: company.organizationId ? company.organizationId.toString() : null,
      avatar: user.avatar ?? null,
      loginAt,
      checkedAt: now,
    }
  } catch (err) {
    // A database blip shouldn't sign everyone out: keep the token and
    // retry on the next request (checkedAt is left unchanged).
    console.error("Session re-validation failed", err)
    return t
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params)
      if (params.user) return token
      return (await revalidateToken(token as unknown as AppJWT)) as unknown as typeof token | null
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").toLowerCase().trim()
        const password = String(credentials?.password ?? "")
        if (!email || !password) return null

        // Broad per-IP limit (guards against spraying many emails from one
        // source) plus a tighter per-IP+email limit (guards against
        // brute-forcing one account). Both count every attempt, success
        // or failure, and fail closed with a generic null — the login
        // page can't tell "wrong password" from "rate limited".
        //
        // Skipped outside production: local dev has no reverse proxy, so
        // every request resolves to the same "unknown" IP bucket, which
        // means testing a handful of demo accounts back-to-back exhausts
        // the broad per-IP limit and locks out every account, not just
        // the one being tested. Production always sees real client IPs.
        if (process.env.NODE_ENV === "production") {
          const ip = getClientIp(request)
          const ipLimit = checkRateLimit(`login:ip:${ip}`, 30, 10 * 60 * 1000)
          const accountLimit = checkRateLimit(`login:account:${ip}:${email}`, 8, 10 * 60 * 1000)
          if (!ipLimit.allowed || !accountLimit.allowed) return null
        }

        await connectDB()

        // Platform admins live in a separate, non-tenant-scoped collection.
        const platformAdmin = await PlatformAdmin.findOne({ email })
        if (platformAdmin) {
          if (!platformAdmin.isActive) return null
          const valid = await bcrypt.compare(password, platformAdmin.passwordHash)
          if (!valid) return null

          platformAdmin.lastLogin = new Date()
          await platformAdmin.save()

          return {
            id: platformAdmin._id.toString(),
            companyId: null,
            branchId: null,
            organizationId: null,
            role: "platform_admin" as const,
            name: platformAdmin.name,
            email: platformAdmin.email,
            avatar: null,
          }
        }

        const user = await User.findOne({ email, deletedAt: null }).setOptions({
          skipTenantGuard: true,
        })
        if (!user || !user.isActive) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        user.lastLogin = new Date()
        await user.save()

        const company = await Company.findOne({ _id: user.companyId }).setOptions({
          skipTenantGuard: true,
        })
        if (!companyIsUsable(company)) throw new InactiveCompanyError()

        return {
          id: user._id.toString(),
          companyId: user.companyId.toString(),
          branchId: user.branchId ? user.branchId.toString() : null,
          organizationId: company?.organizationId ? company.organizationId.toString() : null,
          role: user.role,
          name: user.name,
          email: user.email,
          avatar: user.avatar ?? null,
        }
      },
    }),
  ],
})
