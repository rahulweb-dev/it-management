import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { RbacError } from "@/lib/rbac"

/** Resolves the session for an API route, or returns a 401 response. */
export async function requireSession() {
  const session = await auth()
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { session, response: null }
}

/**
 * Never leak raw error messages to the client in production — Mongoose
 * CastErrors, duplicate-key errors, and our own tenant-guard errors can
 * mention collection/field names an attacker shouldn't see. Full detail
 * still goes to the server log; the client gets a generic 500 in prod
 * and the real message in dev for fast debugging.
 */
export function handleApiError(err: unknown) {
  if (err instanceof RbacError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }

  console.error(err)

  if (process.env.NODE_ENV !== "production") {
    const message = err instanceof Error ? err.message : "Something went wrong"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
}
