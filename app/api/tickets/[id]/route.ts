import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Ticket } from "@/models/Ticket"
import { requireSession, handleApiError } from "@/lib/api"
import { getTicketScopedFilter } from "@/lib/rbac"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    const { id } = await params
    await connectDB()
    const filter = { ...getTicketScopedFilter(session), _id: id }
    const ticket = await Ticket.findOne(filter)
      .populate("raisedBy", "name email")
      .populate("assignedTo", "name email")
      .populate("relatedAssetId", "assetName assetId")
      .populate("comments.userId", "name email")
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    return NextResponse.json({ item: ticket })
  } catch (err) {
    return handleApiError(err)
  }
}
