import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { requireSession, handleApiError } from "@/lib/api"
import { getScopedFilter, assertCompanyRole } from "@/lib/rbac"
import { escapeRegex } from "@/lib/utils"
import { buildAssetsWorkbook } from "@/lib/export/assets-excel"

export async function GET(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    await connectDB()

    const filter: Record<string, any> = getScopedFilter(session)
    const url = new URL(req.url)
    const status = url.searchParams.get("status")
    const category = url.searchParams.get("category")
    const branchId = url.searchParams.get("branchId")
    const search = url.searchParams.get("search")

    if (status) filter.status = status
    if (category) filter.category = category
    if (branchId) filter.branchId = branchId
    if (search) {
      const safeSearch = escapeRegex(search).slice(0, 100)
      filter.$or = [
        { assetName: { $regex: safeSearch, $options: "i" } },
        { assetId: { $regex: safeSearch, $options: "i" } },
        { serialNumber: { $regex: safeSearch, $options: "i" } },
      ]
    }

    const assets = await Asset.find(filter)
      .populate("branchId", "name")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .limit(5000)

    const buffer = await buildAssetsWorkbook(assets)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="assetflow-assets-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
