import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { License } from "@/models/License"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { licenseCreateSchema } from "@/lib/validations/license"
import { licenseStatus } from "@/lib/license-status"
import { escapeRegex } from "@/lib/utils"
import { writeAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    await connectDB()

    const url = new URL(req.url)
    const search = url.searchParams.get("search")
    const archived = url.searchParams.get("archived") === "true"
    const status = url.searchParams.get("status")

    const filter: Record<string, any> = { companyId: session.user.companyId }
    if (archived) {
      filter.deletedAt = { $ne: null }
    }
    if (search) {
      const safeSearch = escapeRegex(search).slice(0, 100)
      filter.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { vendor: { $regex: safeSearch, $options: "i" } },
      ]
    }

    let items = await License.find(filter)
      .populate("assignedTo", "name email")
      .sort({ expiryDate: 1 })

    if (status) {
      items = items.filter((license: any) => licenseStatus(license) === status)
    }

    return NextResponse.json({ items })
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
    const parsed = licenseCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { seats, cost, reminderDaysBefore, assignedTo, ...rest } = parsed.data
    const companyId = session.user.companyId!

    if (new Date(parsed.data.expiryDate) <= new Date(parsed.data.startDate)) {
      return NextResponse.json(
        { error: "Expiry date must be after the start date." },
        { status: 400 }
      )
    }

    await connectDB()
    const license = await License.create({
      ...rest,
      companyId,
      seats: seats ? Number(seats) : 1,
      cost: cost ? Number(cost) : 0,
      reminderDaysBefore: reminderDaysBefore ? Number(reminderDaysBefore) : 30,
      assignedTo: assignedTo || null,
    })

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "license.created",
      entityType: "License",
      entityId: license._id.toString(),
      changes: { name: license.name, vendor: license.vendor },
      request: req,
    })

    return NextResponse.json({ item: license }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
