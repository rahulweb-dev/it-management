import QRCode from "qrcode"
import { uploadBuffer, isImageKitConfigured } from "@/lib/imagekit"

/**
 * Generates a QR PNG pointing at the asset's public scan page and uploads
 * it to ImageKit. Returns null (instead of throwing) when ImageKit isn't
 * configured yet, so asset creation still works before keys are added.
 */
export async function generateAssetQrCode(opts: {
  companyId: string
  assetId: string
}) {
  const url = `${process.env.APP_BASE_URL}/asset/${opts.assetId}`
  const buffer = await QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
  })

  if (!isImageKitConfigured()) return null

  const uploaded = await uploadBuffer({
    buffer,
    fileName: `${opts.assetId}.png`,
    folder: `/qr-codes/${opts.companyId}`,
    companyId: opts.companyId,
  })

  return uploaded.url ?? null
}
