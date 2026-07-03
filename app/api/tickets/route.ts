import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Ticket } from "@/models/Ticket"
import { User } from "@/models/User"
import { Notification } from "@/models/Notification"
import { nextSequence, formatSequence } from "@/models/Counter"
import { requireSession, handleApiError } from "@/lib/api"
import { getTicketScopedFilter } from "@/lib/rbac"
import { ticketCreateSchema } from "@/lib/validations/ticket"
import { computeSlaDeadline } from "@/lib/sla"
import { sendMail } from "@/lib/mail"
import { writeAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    await connectDB()
    const filter: Record<string, any> = getTicketScopedFilter(session)

    const url = new URL(req.url)
    const status = url.searchParams.get("status")
    const priority = url.searchParams.get("priority")
    if (status) filter.status = status
    if (priority) filter.priority = priority

    const tickets = await Ticket.find(filter)
      .populate("raisedBy", "name email")
      .populate("assignedTo", "name email")
      .populate("relatedAssetId", "assetName assetId")
      .sort({ createdAt: -1 })
      .limit(200)

    return NextResponse.json({ items: tickets })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    const body = await req.json()
    const parsed = ticketCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { issueType, priority, description, relatedAssetId } = parsed.data
    const companyId = session.user.companyId!

    await connectDB()
    const seq = await nextSequence(companyId, "ticket")
    const ticketId = formatSequence("TKT", seq)

    const ticket = await Ticket.create({
      companyId,
      ticketId,
      raisedBy: session.user.id,
      issueType,
      priority,
      description,
      relatedAssetId: relatedAssetId || null,
      slaDeadline: computeSlaDeadline(priority),
    })

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "ticket.created",
      entityType: "Ticket",
      entityId: ticket._id.toString(),
      changes: { issueType, priority },
      request: req,
    })

    // Let the IT team know a new ticket landed — this is how they discover work.
    const itPeople = await User.find({ companyId, role: "it_person", isActive: true })
    await Notification.insertMany(
      itPeople.map((itPerson) => ({
        companyId,
        userId: itPerson._id,
        type: "ticket" as const,
        message: `New ${priority} priority ticket ${ticket.ticketId}: ${description.slice(0, 60)}`,
        link: "/tickets",
      }))
    )

    sendMail({
      companyId,
      to: session.user.email,
      template: "ticket-created",
      data: {
        ticketId: ticket.ticketId,
        issueType,
        priority,
        description,
        link: `${process.env.APP_BASE_URL}/tickets`,
      },
    }).catch(() => {})

    return NextResponse.json({ item: ticket }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
