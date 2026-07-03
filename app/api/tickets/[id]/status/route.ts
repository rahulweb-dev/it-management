import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Ticket } from "@/models/Ticket"
import { User } from "@/models/User"
import { Notification } from "@/models/Notification"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { ticketStatusSchema } from "@/lib/validations/ticket"
import { sendMail } from "@/lib/mail"
import { writeAuditLog } from "@/lib/audit"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    const body = await req.json()
    const parsed = ticketStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { status } = parsed.data
    const companyId = session.user.companyId!

    await connectDB()
    const ticket = await Ticket.findOne({ _id: id, companyId })
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

    ticket.status = status
    if (status === "resolved" && !ticket.resolvedAt) ticket.resolvedAt = new Date()
    if (status === "closed" && !ticket.closedAt) ticket.closedAt = new Date()
    await ticket.save()

    const raiser = await User.findOne({ _id: ticket.raisedBy, companyId })
    if (raiser) {
      await Notification.create({
        companyId,
        userId: raiser._id,
        type: "ticket",
        message: `Ticket ${ticket.ticketId} is now ${status.replace("_", " ")}`,
        link: "/tickets",
      })

      sendMail({
        companyId,
        to: raiser.email,
        template: "ticket-status-changed",
        data: { ticketId: ticket.ticketId, status, link: `${process.env.APP_BASE_URL}/tickets` },
      }).catch(() => {})
    }

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "ticket.status_changed",
      entityType: "Ticket",
      entityId: ticket._id.toString(),
      changes: { status },
      request: req,
    })

    return NextResponse.json({ item: ticket })
  } catch (err) {
    return handleApiError(err)
  }
}
