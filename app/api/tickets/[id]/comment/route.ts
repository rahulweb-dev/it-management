import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Ticket } from "@/models/Ticket"
import { Notification } from "@/models/Notification"
import { requireSession, handleApiError } from "@/lib/api"
import { getTicketScopedFilter } from "@/lib/rbac"
import { commentSchema } from "@/lib/validations/ticket"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    const { id } = await params
    const body = await req.json()
    const parsed = commentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const companyId = session.user.companyId!

    await connectDB()
    const filter = { ...getTicketScopedFilter(session), _id: id }
    const ticket = await Ticket.findOne(filter)
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

    ticket.comments.push({
      userId: session.user.id,
      message: parsed.data.message,
      timestamp: new Date(),
    } as any)
    await ticket.save()

    // Notify the other party in the conversation, not the commenter themselves.
    const notifyUserId =
      session.user.id === ticket.raisedBy.toString() ? ticket.assignedTo : ticket.raisedBy
    if (notifyUserId) {
      await Notification.create({
        companyId,
        userId: notifyUserId,
        type: "ticket",
        message: `New comment on ticket ${ticket.ticketId}`,
        link: "/tickets",
      })
    }

    return NextResponse.json({ item: ticket })
  } catch (err) {
    return handleApiError(err)
  }
}
