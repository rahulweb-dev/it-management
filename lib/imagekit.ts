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
