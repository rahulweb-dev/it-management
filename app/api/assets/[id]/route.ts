import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { requireSession, handleApiError } from "@/lib/api"
import { getScopedFilter, assertCompanyRole } from "@/lib/rbac"
import { getAccessibleCompanyIds } from "@/lib/organization"
import { assetUpdateSchema } from "@/lib/validations/asset"
import { writeAuditLog } from "@/lib/audit"
import { assertBranchInCompany } from "@/lib/tenant-refs"
import { resolveProductType, sanitizeSpecs } from "@/lib/constants/product-types"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    const { id } = await params
    await connectDB()

    // it_person gets organization-wide reach (see lib/organization.ts);
    // employees stay limited to their own scoped filter (assets assigned
    // to them in their own company only).
    const filter =
      session.user.role === "it_person"
        ? { _id: id, companyId: { $in: await getAccessibleCompanyIds(session) } }
        : { ...getScopedFilter(session), _id: id }

    const asset = await Asset.findOne(filter)
      .populate("branchId", "name")
      .populate("assignedTo", "name email")
      .populate("companyId", "name")
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    return NextResponse.json({ item: asset })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    const { id } = await params
    const body = await req.json()
    const parsed = assetUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { purchaseDate, warrantyExpiry, amcExpiry, specs, category, ...rest } = parsed.data

    await connectDB()
    const companyIds = await getAccessibleCompanyIds(session)

    // Specs are only meaningful relative to a product type, so resolve the
    // effective type (new one if changing, else the stored/inferred one).
    let specsUpdate: Record<string, string> | undefined
    if (specs !== undefined || rest.branchId) {
      const existing = await Asset.findOne({ _id: id, companyId: { $in: companyIds } })
      if (!existing) return NextResponse.json({ error: "Asset not found" }, { status: 404 })
      // The branch must belong to the asset's own company, not merely one
      // the caller can see across their organization.
      await assertBranchInCompany(existing.companyId.toString(), rest.branchId)
      if (specs !== undefined) {
        specsUpdate = sanitizeSpecs(rest.productType ?? resolveProductType(existing), specs)
      }
    }

    const asset = await Asset.findOneAndUpdate(
      { _id: id, companyId: { $in: companyIds } },
      {
        ...rest,
        ...(category?.trim() && { category: category.trim() }),
        ...(specsUpdate && { specs: specsUpdate }),
        ...(purchaseDate !== undefined && { purchaseDate: purchaseDate || null }),
        // A changed expiry date invalidates any reminder already sent for
        // the old date — clear it so the cron can notify again if the new
        // date falls back inside the reminder window.
        ...(warrantyExpiry !== undefined && {
          warrantyExpiry: warrantyExpiry || null,
          warrantyReminderSentAt: null,
        }),
        ...(amcExpiry !== undefined && { amcExpiry: amcExpiry || null, amcReminderSentAt: null }),
      },
      { new: true }
    )
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 })

    writeAuditLog({
      companyId: asset.companyId.toString(),
      userId: session.user.id,
      action: "asset.updated",
      entityType: "Asset",
      entityId: asset._id.toString(),
      changes: rest,
      request: req,
    })

    return NextResponse.json({ item: asset })
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

    await connectDB()
    const companyIds = await getAccessibleCompanyIds(session)
    const asset = await Asset.findOne({ _id: id, companyId: { $in: companyIds } })
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 })

    await asset.softDelete()

    writeAuditLog({
      companyId: asset.companyId.toString(),
      userId: session.user.id,
      action: "asset.deleted",
      entityType: "Asset",
      entityId: asset._id.toString(),
      request: req,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
