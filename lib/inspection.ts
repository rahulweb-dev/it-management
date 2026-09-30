import { HttpError } from "@/lib/api"
import { uploadBuffer, isImageKitConfigured } from "@/lib/imagekit"
import { assertStorageAvailable } from "@/lib/storage"
import {
  PHOTO_ANGLES,
  productTypeDef,
  checkSeverity,
  type PhotoAngle,
  type ProductType,
  type CheckResult,
} from "@/lib/constants/product-types"
import type { InspectionInput } from "@/lib/validations/asset"

const MAX_PHOTO_BYTES = 8 * 1024 * 1024 // 8 MB each — the client compresses well below this
const PHOTO_FIELD_PREFIX = "photo:"

type InspectionPhotoFile = { angle: PhotoAngle; buffer: Buffer; mime: string }

/** Sniffs the first bytes so a renamed .exe can't be stored as "front.jpg". */
function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp"
  if (buf.toString("ascii", 4, 8) === "ftyp" && /^(heic|heix|mif1|msf1)$/.test(buf.toString("ascii", 8, 12))) {
    return "image/heic"
  }
  return null
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
}

/**
 * Hand-over/return requests are multipart: a `payload` field holding the
 * JSON body, plus one file per photo named `photo:<angle>`.
 */
export async function readInspectionRequest(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    throw new HttpError("Expected a multipart form with condition photos.")
  }

  let body: unknown
  try {
    body = JSON.parse(String(form.get("payload") ?? ""))
  } catch {
    throw new HttpError("Missing or invalid payload.")
  }

  const photos = new Map<PhotoAngle, InspectionPhotoFile>()
  for (const [field, value] of form.entries()) {
    if (!field.startsWith(PHOTO_FIELD_PREFIX) || typeof value === "string") continue
    const angle = field.slice(PHOTO_FIELD_PREFIX.length)
    if (!(angle in PHOTO_ANGLES)) throw new HttpError(`Unknown photo angle "${angle}".`)
    if (value.size > MAX_PHOTO_BYTES) {
      throw new HttpError(`${PHOTO_ANGLES[angle as PhotoAngle]} photo must be under 8 MB.`)
    }
    const buffer = Buffer.from(await value.arrayBuffer())
    const mime = detectImageMime(buffer)
    if (!mime) throw new HttpError(`${PHOTO_ANGLES[angle as PhotoAngle]} photo isn't a JPEG, PNG, WebP or HEIC image.`)
    photos.set(angle as PhotoAngle, { angle: angle as PhotoAngle, buffer, mime })
  }

  return { body, photos }
}

/**
 * Enforces the product type's rules: every required angle photographed,
 * no angles the type doesn't use, and every checklist item answered.
 */
export function validateInspection(
  productType: ProductType,
  input: InspectionInput,
  photos: Map<PhotoAngle, InspectionPhotoFile>
) {
  const def = productTypeDef(productType)

  const missing = def.requiredPhotos.filter((a) => !photos.has(a))
  if (missing.length > 0) {
    throw new HttpError(`Missing required photos: ${missing.map((a) => PHOTO_ANGLES[a]).join(", ")}.`)
  }
  const allowed = new Set<PhotoAngle>([...def.requiredPhotos, ...def.optionalPhotos])
  for (const angle of photos.keys()) {
    if (!allowed.has(angle)) throw new HttpError(`"${PHOTO_ANGLES[angle]}" isn't used for a ${def.label}.`)
  }

  const answered = new Map(input.checklist.map((c) => [c.item, c]))
  if (answered.size !== input.checklist.length) throw new HttpError("Checklist has duplicate items.")
  for (const item of answered.keys()) {
    if (!(def.checklist as string[]).includes(item)) {
      throw new HttpError(`"${item}" isn't a checklist item for a ${def.label}.`)
    }
  }
  const unanswered = def.checklist.filter((item) => !answered.has(item))
  if (unanswered.length > 0) throw new HttpError("Complete every item on the damage checklist.")

  if (photos.size > 0 && !isImageKitConfigured()) {
    throw new HttpError("Photo storage isn't configured yet. Ask your admin to set up ImageKit.", 503)
  }
}

/** Uploads all photos, checking the company's storage quota for the whole batch up front. */
export async function uploadInspectionPhotos(opts: {
  photos: Map<PhotoAngle, InspectionPhotoFile>
  companyId: string
  assetCode: string
  kind: "check_out" | "check_in"
}) {
  const files = [...opts.photos.values()]
  const totalBytes = files.reduce((sum, f) => sum + f.buffer.length, 0)
  await assertStorageAvailable(opts.companyId, totalBytes)

  const stamp = Date.now()
  return Promise.all(
    files.map(async (f) => {
      const uploaded = await uploadBuffer({
        buffer: f.buffer,
        fileName: `${opts.kind}-${f.angle}-${stamp}.${EXT[f.mime]}`,
        folder: `/asset-inspections/${opts.companyId}/${opts.assetCode}`,
        companyId: opts.companyId,
      })
      if (!uploaded.url) throw new HttpError("Photo upload failed — no URL returned.", 502)
      return { angle: f.angle, url: uploaded.url, sizeBytes: f.buffer.length }
    })
  )
}

export function checklistHasDamage(checklist: { result: CheckResult }[]) {
  return checklist.some((c) => c.result !== "ok")
}

/**
 * Items that are worse at return than they were at hand-over — damage
 * that happened while the employee had the asset. With no hand-over
 * inspection on file (assets assigned before inspections existed), any
 * non-ok item counts, since there's no baseline to compare against.
 */
export function diffNewDamage(
  checkOut: { item: string; result: CheckResult }[] | null,
  checkIn: { item: string; result: CheckResult }[]
) {
  const before = new Map((checkOut ?? []).map((c) => [c.item, c.result]))
  return checkIn
    .filter((c) => checkSeverity(c.result) > checkSeverity(before.get(c.item) ?? "ok"))
    .map((c) => c.item)
}
