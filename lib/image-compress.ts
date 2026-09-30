/**
 * Browser-only. Downscales a phone photo (often 4000px / 5MB+) to at most
 * `maxDim` px on the long edge as JPEG before upload — enough detail to
 * see a scratch, at a fraction of the company's storage quota. Falls back
 * to the original file if the browser can't decode it (e.g. HEIC on
 * desktop Chrome); the server accepts HEIC as-is.
 */
export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}
