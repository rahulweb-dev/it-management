"use client"

import { useCallback, useEffect, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { QrCode, UserPlus, UserMinus, Trash2, Wifi, WifiOff, ImagePlus, X } from "lucide-react"
import { toast } from "sonner"
import { deviceStatus } from "@/lib/agent/status"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/status-badge"
import { AssignAssetDialog } from "@/components/assets/assign-asset-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type AssetDetail = {
  _id: string
  assetId: string
  assetName: string
  category: string
  brand: string | null
  model: string | null
  serialNumber: string | null
  status: string
  condition: string
  location: string | null
  qrCodeUrl: string | null
  purchaseDate: string | null
  purchaseCost: number
  vendor: string | null
  warrantyExpiry: string | null
  amcExpiry: string | null
  branchId: { _id: string; name: string } | null
  assignedTo: { _id: string; name: string; email: string } | null
  companyId: { _id: string; name: string } | string
  photos: string[]
  agent?: {
    enrolled: boolean
    hostname: string | null
    cpu: string | null
    ramGb: number | null
    storageGb: number | null
    os: string | null
    ipAddress: string | null
    macAddress: string | null
    loggedInUser: string | null
    agentPlatform: string | null
    lastCheckInAt: string | null
  }
}

type HistoryEntry = {
  _id: string
  assignedDate: string
  returnedDate: string | null
  toUserId: { name: string; email: string } | null
  assignedBy: { name: string } | null
  notes: string | null
}

function fmt(date: string | null) {
  return date ? format(new Date(date), "MMM d, yyyy") : "—"
}

export function AssetDetailSheet({
  assetId,
  open,
  onOpenChange,
  isItPerson,
  onChanged,
}: {
  assetId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isItPerson: boolean
  onChanged: () => void
}) {
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    if (!assetId) return
    const [assetRes, historyRes] = await Promise.all([
      fetch(`/api/assets/${assetId}`),
      fetch(`/api/assets/${assetId}/history`),
    ])
    if (assetRes.ok) setAsset((await assetRes.json()).item)
    if (historyRes.ok) setHistory((await historyRes.json()).items)
  }, [assetId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  async function unassign() {
    if (!assetId) return
    const res = await fetch(`/api/assets/${assetId}/unassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
    if (!res.ok) {
      toast.error("Failed to unassign asset")
      return
    }
    toast.success("Asset unassigned")
    load()
    onChanged()
  }

  async function uploadPhoto(file: File) {
    if (!assetId) return
    setUploading(true)
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const res = await fetch(`/api/assets/${assetId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, dataBase64 }),
    })
    setUploading(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Failed to upload photo")
      return
    }
    toast.success("Photo added")
    load()
  }

  async function removePhoto(url: string) {
    if (!assetId) return
    const res = await fetch(`/api/assets/${assetId}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) {
      toast.error("Failed to remove photo")
      return
    }
    toast.success("Photo removed")
    load()
  }

  async function confirmDelete() {
    if (!assetId) return
    const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to delete asset")
      return
    }
    toast.success("Asset deleted")
    setDeleteOpen(false)
    onOpenChange(false)
    onChanged()
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {!asset ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{asset.assetName}</SheetTitle>
                <SheetDescription>{asset.assetId}</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 px-4 pb-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted">
                    {asset.qrCodeUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.qrCodeUrl}
                        alt={`QR code for ${asset.assetId}`}
                        width={80}
                        height={80}
                        className="rounded-lg"
                      />
                    ) : (
                      <QrCode className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <StatusBadge status={asset.status} />
                    <p className="text-sm text-muted-foreground">{asset.category}</p>
                    {typeof asset.companyId === "object" && (
                      <p className="text-xs text-muted-foreground">{asset.companyId.name}</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium">Photos</h3>
                    {isItPerson && (
                      <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <ImagePlus className="h-3.5 w-3.5" />
                        {uploading ? "Uploading..." : "Add photo"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) uploadPhoto(file)
                            e.target.value = ""
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {asset.photos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No photos yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {asset.photos.map((url) => (
                        <div key={url} className="group relative h-20 w-20 shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={asset.assetName}
                            className="h-full w-full rounded-md border object-cover"
                          />
                          {isItPerson && (
                            <button
                              type="button"
                              onClick={() => removePhoto(url)}
                              className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-status-danger text-status-danger-foreground group-hover:flex"
                              aria-label="Remove photo"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isItPerson && (
                  <div className="flex gap-2">
                    {asset.assignedTo ? (
                      <Button variant="outline" size="sm" onClick={unassign}>
                        <UserMinus className="h-4 w-4" />
                        Unassign
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setAssignOpen(true)}>
                        <UserPlus className="h-4 w-4" />
                        Assign
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto text-status-danger hover:text-status-danger"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <Separator />

                <dl className="grid grid-cols-2 gap-y-3 text-sm">
                  <dt className="text-muted-foreground">Brand / Model</dt>
                  <dd>{[asset.brand, asset.model].filter(Boolean).join(" ") || "—"}</dd>
                  <dt className="text-muted-foreground">Serial number</dt>
                  <dd>{asset.serialNumber || "—"}</dd>
                  <dt className="text-muted-foreground">Branch</dt>
                  <dd>{asset.branchId?.name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Location</dt>
                  <dd>{asset.location || "—"}</dd>
                  <dt className="text-muted-foreground">Condition</dt>
                  <dd className="capitalize">{asset.condition.replace("_", " ")}</dd>
                  <dt className="text-muted-foreground">Assigned to</dt>
                  <dd>{asset.assignedTo?.name ?? "Unassigned"}</dd>
                  <dt className="text-muted-foreground">Vendor</dt>
                  <dd>{asset.vendor || "—"}</dd>
                  <dt className="text-muted-foreground">Purchase date</dt>
                  <dd>{fmt(asset.purchaseDate)}</dd>
                  <dt className="text-muted-foreground">Purchase cost</dt>
                  <dd>{asset.purchaseCost ? `₹${asset.purchaseCost.toLocaleString()}` : "—"}</dd>
                  <dt className="text-muted-foreground">Warranty expiry</dt>
                  <dd>{fmt(asset.warrantyExpiry)}</dd>
                  <dt className="text-muted-foreground">AMC expiry</dt>
                  <dd>{fmt(asset.amcExpiry)}</dd>
                </dl>

                {asset.agent?.enrolled && (
                  <>
                    <Separator />
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <h3 className="text-sm font-medium">Live device info</h3>
                        {(() => {
                          const status = deviceStatus(asset.agent!.lastCheckInAt)
                          return (
                            <Badge
                              variant="outline"
                              className={
                                status === "online"
                                  ? "border-status-success/30 bg-status-success/15 text-status-success"
                                  : "border-status-danger/30 bg-status-danger/15 text-status-danger"
                              }
                            >
                              {status === "online" ? (
                                <Wifi className="h-3 w-3" />
                              ) : (
                                <WifiOff className="h-3 w-3" />
                              )}
                              {status === "never" ? "Never checked in" : status}
                            </Badge>
                          )
                        })()}
                      </div>
                      <dl className="grid grid-cols-2 gap-y-3 text-sm">
                        <dt className="text-muted-foreground">Hostname</dt>
                        <dd>{asset.agent.hostname || "—"}</dd>
                        <dt className="text-muted-foreground">CPU</dt>
                        <dd className="truncate" title={asset.agent.cpu ?? ""}>
                          {asset.agent.cpu || "—"}
                        </dd>
                        <dt className="text-muted-foreground">RAM</dt>
                        <dd>{asset.agent.ramGb ? `${asset.agent.ramGb} GB` : "—"}</dd>
                        <dt className="text-muted-foreground">Storage</dt>
                        <dd>{asset.agent.storageGb ? `${asset.agent.storageGb} GB` : "—"}</dd>
                        <dt className="text-muted-foreground">OS</dt>
                        <dd>{asset.agent.os || "—"}</dd>
                        <dt className="text-muted-foreground">IP address</dt>
                        <dd>{asset.agent.ipAddress || "—"}</dd>
                        <dt className="text-muted-foreground">MAC address</dt>
                        <dd>{asset.agent.macAddress || "—"}</dd>
                        <dt className="text-muted-foreground">Logged-in user</dt>
                        <dd>{asset.agent.loggedInUser || "—"}</dd>
                        <dt className="text-muted-foreground">Last check-in</dt>
                        <dd>
                          {asset.agent.lastCheckInAt
                            ? formatDistanceToNow(new Date(asset.agent.lastCheckInAt), { addSuffix: true })
                            : "—"}
                        </dd>
                      </dl>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <h3 className="mb-3 text-sm font-medium">Assignment history</h3>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assignment history yet.</p>
                  ) : (
                    <ol className="relative space-y-4 border-l pl-4">
                      {history.map((h) => (
                        <li key={h._id} className="relative">
                          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                          <p className="text-sm font-medium">{h.toUserId?.name ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmt(h.assignedDate)} — {h.returnedDate ? fmt(h.returnedDate) : "current"}
                          </p>
                          {h.assignedBy && (
                            <p className="text-xs text-muted-foreground">by {h.assignedBy.name}</p>
                          )}
                          {h.notes && <p className="mt-1 text-xs">{h.notes}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AssignAssetDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        assetId={assetId}
        companyId={typeof asset?.companyId === "object" ? asset.companyId._id : asset?.companyId}
        onAssigned={() => {
          load()
          onChanged()
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {asset?.assetName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This asset will be archived. Its assignment history is kept for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
