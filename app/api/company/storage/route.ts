import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { getStorageStatus } from "@/lib/storage"

export async function GET() {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    await connectDB()
    const status = await getStorageStatus(session.user.companyId!)
    return NextResponse.json(status)
  } catch (err) {
    return handleApiError(err)
  }
}
