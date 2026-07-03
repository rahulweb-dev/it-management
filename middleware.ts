import { NextResponse } from "next/server"
import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

const { auth } = NextAuth(authConfig)

// Pages under the company dashboard that only "it_person" may open —
// "employee" gets bounced back to /dashboard.
const IT_PERSON_ONLY_PREFIXES = [
  "/branches",
  "/employees",
  "/inventory",
  "/purchases",
  "/reports",
  "/licenses",
]

function homeFor(role: string) {
  return role === "platform_admin" ? "/platform" : "/dashboard"
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth
  const isAuthPage =
    pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password"
  const isPublicPage =
    pathname.startsWith("/asset/") ||
    pathname.startsWith("/agent/install/") ||
    pathname.startsWith("/employee-onboard/")
  const isPlatformArea = pathname.startsWith("/platform")
  const isSharedPage = pathname === "/profile"

  if (isPublicPage) return NextResponse.next()

  if (!isLoggedIn && !isAuthPage) {
    const url = new URL("/login", req.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  if (isLoggedIn) {
    const role = req.auth!.user.role

    if (isAuthPage) {
      return NextResponse.redirect(new URL(homeFor(role), req.url))
    }

    // Platform admins only operate in /platform — they have no company to
    // see a dashboard/assets/tickets for. Company users can't see /platform.
    // /profile is neutral ground both sides can reach.
    if (!isSharedPage) {
      if (isPlatformArea && role !== "platform_admin") {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
      if (!isPlatformArea && role === "platform_admin") {
        return NextResponse.redirect(new URL("/platform", req.url))
      }
    }

    if (role === "employee" && IT_PERSON_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
