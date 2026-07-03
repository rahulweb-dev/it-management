import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Branch } from "@/models/Branch"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { assertCompanyInOrganization } from "@/lib/organization"
import { branchSchema } from "@/lib/validations/branch"
import { writeAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    await connectDB()
    const url = new URL(req.url)
    const archived = url.searchParams.get("archived") === "true"
    const requestedCompanyId = url.searchParams.get("companyId")

    let companyId = session.user.companyId
    if (requestedCompanyId && requestedCompanyId !== session.user.companyId) {
      assertCompanyRole(session, "it_person")
      await assertCompanyInOrganization(session.user.organizationId, requestedCompanyId)
      companyId = requestedCompanyId
    }

    const filter: Record<string, any> = { companyId }
    if (archived) {
      assertCompanyRole(session, "it_person")
      filter.deletedAt = { $ne: null }
    }

    const branches = await Branch.find(filter)
      .populate("managerId", "name email")
      .sort({ name: 1 })
    return NextResponse.json({ items: branches })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const body = await req.json()
    const parsed = branchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    await connectDB()
    const branch = await Branch.create({
      ...parsed.data,
      managerId: parsed.data.managerId || null,
      companyId: session.user.companyId,
    })
    writeAuditLog({
      companyId: session.user.companyId!,
      userId: session.user.id,
      action: "branch.created",
      entityType: "Branch",
      entityId: branch._id.toString(),
      changes: { name: branch.name },
      request: req,
    })

    return NextResponse.json({ item: branch }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
