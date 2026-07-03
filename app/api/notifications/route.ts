import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Notification } from "@/models/Notification"
import { requireSession, handleApiError } from "@/lib/api"

export async function GET() {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    await connectDB()
    const filter = { companyId: session.user.companyId, userId: session.user.id }
    const [items, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(20),
      Notification.countDocuments({ ...filter, isRead: false }),
    ])
    return NextResponse.json({ items, unreadCount })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    await connectDB()
    const body = await req.json().catch(() => ({}))
    const filter = { companyId: session.user.companyId, userId: session.user.id }

    if (body.id) {
      await Notification.updateOne({ ...filter, _id: body.id }, { isRead: true })
    } else {
      await Notification.updateMany({ ...filter, isRead: false }, { isRead: true })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
