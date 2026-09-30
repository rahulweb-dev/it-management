import ImageKit, { toFile } from "@imagekit/nodejs"
import { assertStorageAvailable, recordStorageUsage } from "@/lib/storage"

let client: ImageKit | null = null

/** Server-side ImageKit client. Returns null if keys aren't configured yet. */
export function getImageKitClient() {
  if (!process.env.IMAGEKIT_PRIVATE_KEY) return null
  if (!client) {
    client = new ImageKit({ privateKey: process.env.IMAGEKIT_PRIVATE_KEY })
  }
  return client
}

/** Auth params handed to the browser so uploads go client -> ImageKit directly. */
export function getUploadAuthParams() {
  const ik = getImageKitClient()
  if (!ik) {
    throw new Error("ImageKit is not configured. Add IMAGEKIT_PRIVATE_KEY to .env.local")
  }
  const params = ik.helper.getAuthenticationParameters()
  return {
    ...params,
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  }
}

/**
 * companyId is required so every upload (QR codes today; photos, invoices,
 * ticket attachments as those ship) gets checked against that company's
 * plan storage limit and counted toward it in one place, rather than each
 * call site having to remember to do both.
 */
export async function uploadBuffer(opts: {
  buffer: Buffer
  fileName: string
  folder: string
  companyId: string
}) {
  const ik = getImageKitClient()
  if (!ik) {
    throw new Error("ImageKit is not configured. Add IMAGEKIT_PRIVATE_KEY to .env.local")
  }

  await assertStorageAvailable(opts.companyId, opts.buffer.length)

  const response = await ik.files.upload({
    file: await toFile(opts.buffer, opts.fileName),
    fileName: opts.fileName,
    folder: opts.folder,
    useUniqueFileName: true,
  })

  await recordStorageUsage(opts.companyId, opts.buffer.length)

  return response
}

export function isImageKitConfigured() {
  return Boolean(
    process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT
  )
}

/**
 * Deletes an uploaded file given the URL we stored for it, and gives the
 * bytes back to the company's storage quota. Only files under one of
 * `allowedFolders` (always a company-scoped folder) can be deleted, so a
 * URL can never reach another tenant's files. Returns the bytes freed, or
 * 0 if the file was already gone.
 */
export async function deleteFileByUrl(opts: { url: string; companyId: string; allowedFolders: string[] }) {
  const ik = getImageKitClient()
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT?.replace(/\/+$/, "")
  if (!ik || !endpoint || !opts.url.startsWith(endpoint + "/")) return 0

  const filePath = decodeURIComponent(new URL(opts.url).pathname.slice(new URL(endpoint).pathname.replace(/\/+$/, "").length))
  if (filePath.includes("..") || !opts.allowedFolders.some((f) => filePath.startsWith(f.replace(/\/?$/, "/")))) return 0

  const slash = filePath.lastIndexOf("/")
  const folder = filePath.slice(0, slash + 1)
  const name = filePath.slice(slash + 1)
  const matches = await ik.assets.list({ path: folder, searchQuery: `name = "${name.replace(/"/g, '\\"')}"`, limit: 5 })
  const file = matches.find((f) => "fileId" in f && (f as { filePath?: string }).filePath === filePath) as
    | { fileId?: string; size?: number }
    | undefined
  if (!file?.fileId) return 0

  await ik.files.delete(file.fileId)
  const size = file.size ?? 0
  if (size > 0) await recordStorageUsage(opts.companyId, -size)
  return size
}
