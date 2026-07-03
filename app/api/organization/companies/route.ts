import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { getOrganizationCompanies } from "@/lib/organization"

/**
 * Sibling companies in the caller's organization (including their own),
 * for the "which company is this for" selectors in the assets UI. Empty
 * list means the company isn't part of an organization — callers should
 * treat that as "no multi-company access", not an error.
 */
export async function GET() {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    if (!session.user.organizationId) {
      return NextResponse.json({ items: [] })
    }

    await connectDB()
    const companies = await getOrganizationCompanies(session.user.organizationId)
    return NextResponse.json({ items: companies })
  } catch (err) {
    return handleApiError(err)
  }
}
