import type { NextAuthConfig } from "next-auth"
import type { Role } from "@/lib/constants/enums"

/**
 * Auth.js's JWT type lives at "@auth/core/jwt", but that package isn't
 * always hoisted to a resolvable top-level path (npm may nest it inside
 * next-auth's own node_modules depending on the install), which makes
 * `declare module "@auth/core/jwt"` an unreliable augmentation target —
 * it's broken here twice across two different installs. Casting to this
 * local shape instead means our typing doesn't depend on that path at all.
 */
type AppJWT = {
  id: string
  companyId: string | null
  branchId: string | null
  organizationId: string | null
  role: Role
  avatar: string | null
}

/**
 * Edge-safe config shared by middleware and the full server-side auth.ts.
 * No providers here — Credentials' authorize() touches Mongoose/MongoDB,
 * which isn't Edge-compatible, and middleware runs on the Edge runtime.
 * Middleware only needs to read an already-issued JWT, not authenticate.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const t = token as unknown as AppJWT
        t.id = (user as any).id
        t.companyId = (user as any).companyId
        t.branchId = (user as any).branchId
        t.organizationId = (user as any).organizationId ?? null
        t.role = (user as any).role
        t.avatar = (user as any).avatar
      }
      return token
    },
    async session({ session, token }) {
      const t = token as unknown as AppJWT
      session.user.id = t.id
      session.user.companyId = t.companyId
      session.user.branchId = t.branchId
      session.user.organizationId = t.organizationId ?? null
      session.user.role = t.role
      session.user.avatar = t.avatar
      return session
    },
  },
} satisfies NextAuthConfig
