import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { License } from "@/models/License"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { licenseUpdateSchema } from "@/lib/validations/license"
import { writeAuditLog } from "@/lib/audit"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    const body = await req.json()
    const parsed = licenseUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { seats, cost, reminderDaysBefore, assignedTo, ...rest } = parsed.data
    const companyId = session.user.companyId!

    await connectDB()
    const license = await License.findOne({ _id: id, companyId })
    if (!license) return NextResponse.json({ error: "License not found" }, { status: 404 })

    const nextExpiryDate = rest.expiryDate ?? license.expiryDate.toISOString()
    const nextStartDate = rest.startDate ?? license.startDate.toISOString()
    if (new Date(nextExpiryDate) <= new Date(nextStartDate)) {
      return NextResponse.json(
        { error: "Expiry date must be after the start date." },
        { status: 400 }
      )
    }

    Object.assign(license, rest)
    if (seats !== undefined) license.seats = seats ? Number(seats) : 1
    if (cost !== undefined) license.cost = cost ? Number(cost) : 0
    if (reminderDaysBefore !== undefined) {
      license.reminderDaysBefore = reminderDaysBefore ? Number(reminderDaysBefore) : 30
    }
    if (assignedTo !== undefined) license.assignedTo = assignedTo || null
    // A changed expiry date invalidates any reminder already sent for the
    // old date — clear it so the cron can notify again for the new date.
    if (rest.expiryDate) license.lastReminderSentAt = null

    await license.save()

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "license.updated",
      entityType: "License",
      entityId: license._id.toString(),
      changes: rest,
      request: req,
    })

    return NextResponse.json({ item: license })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    const companyId = session.user.companyId!

    await connectDB()
    const license = await License.findOne({ _id: id, companyId })
    if (!license) return NextResponse.json({ error: "License not found" }, { status: 404 })

    await license.softDelete()

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "license.deleted",
      entityType: "License",
      entityId: license._id.toString(),
      request: req,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
