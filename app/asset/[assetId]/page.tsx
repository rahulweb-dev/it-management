import { headers } from "next/headers"
import { auth } from "@/auth"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { QrCode, ShieldAlert } from "lucide-react"
import { checkRateLimit } from "@/lib/rate-limit"

export default async function PublicAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>
}) {
  const { assetId } = await params

  const headerList = await headers()
  const ip = headerList.get("x-forwarded-for")?.split(",")[0].trim() ?? headerList.get("x-real-ip") ?? "unknown"
  const { allowed } = checkRateLimit(`asset-scan:${ip}`, 60, 60 * 1000)
  if (!allowed) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">Too many requests</h1>
        <p className="text-sm text-muted-foreground">Please wait a moment and try again.</p>
      </div>
    )
  }

  const session = await auth()

  await connectDB()
  const asset = session?.user.companyId
    ? await Asset.findOne({ assetId, companyId: session.user.companyId })
        .populate("assignedTo", "name email")
        .populate("branchId", "name")
    : null

  if (session && asset) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 py-12">
        <h1 className="text-xl font-semibold">{asset.assetName}</h1>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-muted-foreground">Asset ID</dt>
          <dd>{asset.assetId}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="capitalize">{asset.status.replace("_", " ")}</dd>
          <dt className="text-muted-foreground">Branch</dt>
          <dd>{asset.branchId?.name ?? "—"}</dd>
          <dt className="text-muted-foreground">Assigned to</dt>
          <dd>{asset.assignedTo?.name ?? "Unassigned"}</dd>
          <dt className="text-muted-foreground">Warranty expiry</dt>
          <dd>{asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : "—"}</dd>
        </dl>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <QrCode className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-semibold">Asset {assetId}</h1>
      <p className="text-sm text-muted-foreground">
        Sign in with your company account to see this asset&apos;s details, or report it if found.
      </p>
      <a href="/login" className="text-sm font-medium text-primary underline underline-offset-4">
        Sign in
      </a>
    </div>
  )
}
