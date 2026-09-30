import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { AssetInspection } from "@/models/AssetInspection"
import { requireSession, handleApiError } from "@/lib/api"
import { writeAuditLog } from "@/lib/audit"

// The employee who received an asset confirms the hand-over photos and
// checklist match what they got. Only that employee can acknowledge.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    const { id } = await params
    const companyId = session.user.companyId
    if (!companyId || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 })
    }

    await connectDB()
    const inspection = await AssetInspection.findOneAndUpdate(
      { _id: id, companyId, employeeId: session.user.id, kind: "check_out", acknowledgedAt: null },
      { acknowledgedAt: new Date() },
      { new: true }
    )
    if (!inspection) {
      const existing = await AssetInspection.findOne({ _id: id, companyId, employeeId: session.user.id })
      if (existing?.acknowledgedAt) return NextResponse.json({ item: existing })
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 })
    }

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "asset.handover_acknowledged",
      entityType: "Asset",
      entityId: inspection.assetId.toString(),
      changes: { inspectionId: inspection._id.toString() },
      request: req,
    })

    return NextResponse.json({ item: inspection })
  } catch (err) {
    return handleApiError(err)
  }
}
