import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Ticket } from "@/models/Ticket"
import { User } from "@/models/User"
import { Notification } from "@/models/Notification"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { ticketAssignSchema } from "@/lib/validations/ticket"
import { sendMail } from "@/lib/mail"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    const body = await req.json()
    const parsed = ticketAssignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { assignedTo } = parsed.data
    const companyId = session.user.companyId!

    await connectDB()
    const ticket = await Ticket.findOne({ _id: id, companyId })
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

    const assignee = await User.findOne({ _id: assignedTo, companyId, role: "it_person" })
    if (!assignee) return NextResponse.json({ error: "Assignee must be an IT Person" }, { status: 404 })

    ticket.assignedTo = assignee._id
    if (ticket.status === "open") ticket.status = "assigned"
    await ticket.save()

    await Notification.create({
      companyId,
      userId: assignee._id,
      type: "ticket",
      message: `Ticket ${ticket.ticketId} has been assigned to you`,
      link: "/tickets",
    })

    sendMail({
      companyId,
      to: assignee.email,
      template: "ticket-assigned",
      data: {
        ticketId: ticket.ticketId,
        description: ticket.description,
        link: `${process.env.APP_BASE_URL}/tickets`,
      },
    }).catch(() => {})

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "ticket.assigned",
      entityType: "Ticket",
      entityId: ticket._id.toString(),
      changes: { assignedTo: assignee._id.toString() },
      request: req,
    })

    return NextResponse.json({ item: ticket })
  } catch (err) {
    return handleApiError(err)
  }
}
