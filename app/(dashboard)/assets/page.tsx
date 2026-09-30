"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { Boxes, Plus, Search, Archive, ArchiveRestore, FileSpreadsheet, Building2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/empty-state"
import { ASSET_STATUSES } from "@/lib/constants/enums"
import { PRODUCT_TYPES, PRODUCT_TYPE_KEYS, resolveProductType } from "@/lib/constants/product-types"
import { deviceStatus } from "@/lib/agent/status"
import { cn } from "@/lib/utils"
import { AssetFormDialog } from "@/components/assets/asset-form-dialog"
import { AssetDetailSheet } from "@/components/assets/asset-detail-sheet"

type AssetRow = {
  _id: string
  assetId: string
  assetName: string
  category: string
  productType?: string | null
  status: string
  branchId: { _id: string; name: string } | null
  assignedTo: { _id: string; name: string; email: string } | null
  companyId?: { _id: string; name: string } | string
  agent?: { enrolled: boolean; lastCheckInAt: string | null }
}

type Branch = { _id: string; name: string }
type Company = { _id: string; name: string }

export default function AssetsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isItPerson = session?.user.role === "it_person"

  const [assets, setAssets] = useState<AssetRow[] | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [orgCompanies, setOrgCompanies] = useState<Company[]>([])
  const [status, setStatus] = useState(searchParams.get("status") ?? "all")
  const [branchId, setBranchId] = useState("all")
  const [productType, setProductType] = useState("all")
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [allCompanies, setAllCompanies] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (showArchived) {
      params.set("archived", "true")
    } else {
      if (status !== "all") params.set("status", status)
      if (branchId !== "all") params.set("branchId", branchId)
      if (productType !== "all") params.set("productType", productType)
      if (search) params.set("search", search)
      if (allCompanies) params.set("scope", "organization")
    }
    const res = await fetch(`/api/assets?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setAssets(data.items)
    }
  }, [status, branchId, productType, search, showArchived, allCompanies])

  function exportHref() {
    const params = new URLSearchParams()
    if (status !== "all") params.set("status", status)
    if (branchId !== "all") params.set("branchId", branchId)
    if (search) params.set("search", search)
    return `/api/assets/export?${params.toString()}`
  }

  async function restore(assetId: string) {
    const res = await fetch(`/api/assets/${assetId}/restore`, { method: "POST" })
    if (!res.ok) {
      toast.error("Failed to restore asset")
      return
    }
    toast.success("Asset restored")
    load()
  }

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (isItPerson) {
      fetch("/api/branches")
        .then((res) => res.json())
        .then((data) => setBranches(data.items ?? []))
      fetch("/api/organization/companies")
        .then((res) => res.json())
        .then((data) => setOrgCompanies(data.items ?? []))
    }
  }, [isItPerson])

  useEffect(() => {
    if (searchParams.get("new") && isItPerson) {
      setCreateOpen(true)
      router.replace("/assets")
    }
  }, [searchParams, router, isItPerson])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {showArchived ? "Archived assets" : allCompanies ? "Assets — all companies" : "Assets"}
          </h1>
          <p className="text-muted-foreground">
            {showArchived
              ? "Deleted assets — restore one to bring it back."
              : allCompanies
                ? "Every asset across every company in your organization."
                : isItPerson
                  ? "Every asset across your company."
                  : "Assets currently assigned to you."}
          </p>
        </div>
        <div className="flex gap-2">
          {isItPerson && !showArchived && orgCompanies.length > 1 && (
            <Button
              variant={allCompanies ? "default" : "outline"}
              onClick={() => setAllCompanies((v) => !v)}
            >
              <Building2 className="h-4 w-4" />
              {allCompanies ? "This company" : "All companies"}
            </Button>
          )}
          {isItPerson && (
            <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? (
                <>
                  <Boxes className="h-4 w-4" />
                  Back to assets
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" />
                  Archived
                </>
              )}
            </Button>
          )}
          {isItPerson && !showArchived && (
            <Button variant="outline" asChild>
              <a href={exportHref()} download>
                <FileSpreadsheet className="h-4 w-4" />
                Export
              </a>
            </Button>
          )}
          {isItPerson && !showArchived && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Add asset
            </Button>
          )}
        </div>
      </div>

      {!showArchived && (
        <div className="flex flex-wrap gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, asset ID, serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ASSET_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {PRODUCT_TYPE_KEYS.map((t) => (
                <SelectItem key={t} value={t}>
                  {PRODUCT_TYPES[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isItPerson && branches.length > 0 && (
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b._id} value={b._id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {assets === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={showArchived ? Archive : Boxes}
          title={showArchived ? "No archived assets" : isItPerson ? "No assets yet" : "No assets assigned to you"}
          description={
            showArchived
              ? "Deleted assets will show up here so you can restore them if needed."
              : isItPerson
                ? "Add your first asset to start tracking laptops, monitors, and more."
                : "Assets your IT team assigns to you will show up here."
          }
          actionLabel={isItPerson && !showArchived ? "Add asset" : undefined}
          onAction={isItPerson && !showArchived ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                {allCompanies && <TableHead>Company</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned to</TableHead>
                {showArchived && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow
                  key={asset._id}
                  className={showArchived ? "" : "cursor-pointer"}
                  onClick={() => !showArchived && setSelectedAsset(asset._id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {asset.agent?.enrolled && (
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            deviceStatus(asset.agent.lastCheckInAt) === "online"
                              ? "bg-status-success"
                              : "bg-status-danger"
                          )}
                          title={
                            deviceStatus(asset.agent.lastCheckInAt) === "online"
                              ? "Device online"
                              : "Device offline"
                          }
                        />
                      )}
                      <div>
                        <p className="font-medium">{asset.assetName}</p>
                        <p className="text-xs text-muted-foreground">{asset.assetId}</p>
                      </div>
                    </div>
                  </TableCell>
                  {allCompanies && (
                    <TableCell>
                      {typeof asset.companyId === "object" && asset.companyId ? asset.companyId.name : "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <p>{PRODUCT_TYPES[resolveProductType(asset)].label}</p>
                    {asset.category !== PRODUCT_TYPES[resolveProductType(asset)].label && (
                      <p className="text-xs text-muted-foreground">{asset.category}</p>
                    )}
                  </TableCell>
                  <TableCell>{asset.branchId?.name ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={asset.status} />
                  </TableCell>
                  <TableCell>
                    {asset.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {asset.assignedTo.name
                              .split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{asset.assignedTo.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  {showArchived && (
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          restore(asset._id)
                        }}
                      >
                        <ArchiveRestore className="h-4 w-4" />
                        Restore
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AssetFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={load} />

      <AssetDetailSheet
        assetId={selectedAsset}
        open={!!selectedAsset}
        onOpenChange={(open) => !open && setSelectedAsset(null)}
        isItPerson={isItPerson}
        onChanged={load}
      />
    </div>
  )
}
