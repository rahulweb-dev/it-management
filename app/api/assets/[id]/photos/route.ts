import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { requireSession, handleApiError } from "@/lib/api"
import { assertCompanyRole } from "@/lib/rbac"
import { getAccessibleCompanyIds } from "@/lib/organization"
import { addPhotoSchema, removePhotoSchema } from "@/lib/validations/asset-photo"
import { uploadBuffer, isImageKitConfigured } from "@/lib/imagekit"
import { StorageLimitError } from "@/lib/storage"
import { writeAuditLog } from "@/lib/audit"

const MAX_PHOTOS_PER_ASSET = 8
const MAX_PHOTO_BYTES = 8 * 1024 * 1024 // 8 MB

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertCompanyRole(session, "it_person")
    if (!isImageKitConfigured()) {
      return NextResponse.json(
        { error: "Photo storage isn't configured yet. Ask your admin to set up ImageKit." },
        { status: 503 }
      )
    }

    const { id } = await params
    const body = await req.json()
    const parsed = addPhotoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    await connectDB()
    const companyIds = await getAccessibleCompanyIds(session)
    const asset = await Asset.findOne({ _id: id, companyId: { $in: companyIds } })
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    const companyId = asset.companyId.toString()

    if (asset.photos.length >= MAX_PHOTOS_PER_ASSET) {
      return NextResponse.json(
        { error: `Each asset can have up to ${MAX_PHOTOS_PER_ASSET} photos.` },
        { status: 400 }
      )
    }

    const base64 = parsed.data.dataBase64.replace(/^data:[^;]+;base64,/, "")
    const buffer = Buffer.from(base64, "base64")

    if (buffer.length > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "Photo must be under 8 MB." }, { status: 400 })
    }

    let uploaded
    try {
      uploaded = await uploadBuffer({
        buffer,
        fileName: parsed.data.fileName,
        folder: `/asset-photos/${companyId}/${asset.assetId}`,
        companyId,
      })
    } catch (err) {
      if (err instanceof StorageLimitError) {
        return NextResponse.json({ error: err.message }, { status: 413 })
      }
      throw err
    }

    if (!uploaded.url) {
      return NextResponse.json({ error: "Upload failed — no URL returned." }, { status: 502 })
    }

    asset.photos.push(uploaded.url)
    await asset.save()

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "asset.photo_added",
      entityType: "Asset",
      entityId: asset._id.toString(),
      request: req,
    })

    return NextResponse.json({ item: asset }, { status: 201 })
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
    const body = await req.json()
    const parsed = removePhotoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    await connectDB()
    const companyIds = await getAccessibleCompanyIds(session)
    const asset = await Asset.findOne({ _id: id, companyId: { $in: companyIds } })
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    const companyId = asset.companyId.toString()

    asset.photos = asset.photos.filter((p: string) => p !== parsed.data.url)
    await asset.save()

    writeAuditLog({
      companyId,
      userId: session.user.id,
      action: "asset.photo_removed",
      entityType: "Asset",
      entityId: asset._id.toString(),
      request: req,
    })

    return NextResponse.json({ item: asset })
  } catch (err) {
    return handleApiError(err)
  }
}
