import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { Branch } from "@/models/Branch"
import { nextSequence, formatSequence } from "@/models/Counter"
import { requireSession, handleApiError } from "@/lib/api"
import { getScopedFilter, assertCompanyRole } from "@/lib/rbac"
import { getOrganizationCompanyIds, assertCompanyInOrganization } from "@/lib/organization"
import { assetCreateSchema } from "@/lib/validations/asset"
import { generateAssetQrCode } from "@/lib/qrcode"
import { escapeRegex } from "@/lib/utils"
import { writeAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    await connectDB()
    const filter: Record<string, any> = getScopedFilter(session)

    const url = new URL(req.url)
    const status = url.searchParams.get("status")
    const category = url.searchParams.get("category")
    const branchId = url.searchParams.get("branchId")
    const search = url.searchParams.get("search")
    const archived = url.searchParams.get("archived") === "true"
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1))
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)))
    const scope = url.searchParams.get("scope")

    // Explicitly setting deletedAt here (rather than leaving it undefined)
    // opts out of the tenant plugin's default "exclude deleted" filter —
    // see lib/mongoose/tenantPlugin.ts.
    if (archived) {
      assertCompanyRole(session, "it_person")
      filter.deletedAt = { $ne: null }
    }

    // Aggregated cross-company view for an IT Person whose company belongs
    // to an Organization — overrides the single-company filter above with
    // every sibling companyId, never merging past what the org allows.
    const crossCompany = scope === "organization"
    if (crossCompany) {
      assertCompanyRole(session, "it_person")
      if (!session.user.organizationId) {
        return NextResponse.json({ error: "Your company isn't part of an organization." }, { status: 400 })
      }
      const companyIds = await getOrganizationCompanyIds(session.user.organizationId)
      filter.companyId = { $in: companyIds }
    }

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

    let query = Asset.find(filter)
      .populate("branchId", "name")
      .populate("assignedTo", "name email")
    if (crossCompany) {
      query = query.populate("companyId", "name")
    }

    const [items, total] = await Promise.all([
      query.sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Asset.countDocuments(filter),
    ])

    return NextResponse.json({ items, total, page, limit })
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
    const parsed = assetCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { purchaseDate, purchaseCost, warrantyExpiry, amcExpiry, targetCompanyId, ...rest } = parsed.data
    const cost = purchaseCost ? Number(purchaseCost) : 0

    await connectDB()
    let companyId = session.user.companyId!
    if (targetCompanyId && targetCompanyId !== companyId) {
      await assertCompanyInOrganization(session.user.organizationId, targetCompanyId)
      companyId = targetCompanyId
    }

    const branch = await Branch.findOne({ _id: rest.branchId, companyId })
    if (!branch) {
      return NextResponse.json({ error: "Branch not found for the selected company." }, { status: 400 })
    }

    const seq = await nextSequence(companyId, "asset")
    const assetId = formatSequence("AST", seq)

    const asset = await Asset.create({
      ...rest,
      assetId,
      companyId,
      purchaseDate: purchaseDate || null,
      purchaseCost: cost,
      currentValue: cost,
      warrantyExpiry: warrantyExpiry || null,
      amcExpiry: amcExpiry || null,
    })

    // QR generation is best-effort — asset creation shouldn't fail just
    // because ImageKit isn't configured yet.
    try {
      const qrCodeUrl = await generateAssetQrCode({ companyId, assetId })
      if (qrCodeUrl) {
        asset.qrCodeUrl = qrCodeUrl
        await asset.save()
      }
    } catch (err) {
      console.error("QR generation failed for", assetId, err)
    }

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "asset.created",
      entityType: "Asset",
      entityId: asset._id.toString(),
      changes: { assetName: asset.assetName, category: asset.category },
      request: req,
    })

    return NextResponse.json({ item: asset }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
