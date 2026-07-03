"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyRound, Plus, Search, Archive, ArchiveRestore, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/empty-state"
import { LICENSE_STATUSES } from "@/lib/constants/enums"
import { licenseStatus } from "@/lib/license-status"
import { LicenseFormDialog, type LicenseRecord } from "@/components/licenses/license-form-dialog"

function fmt(date: string) {
  return format(new Date(date), "MMM d, yyyy")
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<LicenseRecord[] | null>(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [showArchived, setShowArchived] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LicenseRecord | null>(null)
  const [deleting, setDeleting] = useState<LicenseRecord | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (showArchived) {
      params.set("archived", "true")
    } else {
      if (search) params.set("search", search)
      if (status !== "all") params.set("status", status)
    }
    const res = await fetch(`/api/licenses?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setLicenses(data.items)
    }
  }, [search, status, showArchived])

  useEffect(() => {
    load()
  }, [load])

  async function confirmDelete() {
    if (!deleting) return
    const res = await fetch(`/api/licenses/${deleting._id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to delete license")
    } else {
      toast.success("License deleted")
      load()
    }
    setDeleting(null)
  }

  async function restore(id: string) {
    const res = await fetch(`/api/licenses/${id}/restore`, { method: "POST" })
    if (!res.ok) {
      toast.error("Failed to restore license")
      return
    }
    toast.success("License restored")
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{showArchived ? "Archived licenses" : "Licenses"}</h1>
          <p className="text-muted-foreground">
            {showArchived
              ? "Deleted licenses — restore one to bring it back."
              : "Every software license, its cost, and when it renews or expires."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? (
              <>
                <KeyRound className="h-4 w-4" />
                Back to licenses
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                Archived
              </>
            )}
          </Button>
          {!showArchived && (
            <Button
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Add license
            </Button>
          )}
        </div>
      </div>

      {!showArchived && (
        <div className="flex flex-wrap gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {LICENSE_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {licenses === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : licenses.length === 0 ? (
        <EmptyState
          icon={showArchived ? Archive : KeyRound}
          title={showArchived ? "No archived licenses" : "No licenses yet"}
          description={
            showArchived
              ? "Deleted licenses will show up here so you can restore them if needed."
              : "Track software licenses, their cost, and get reminded before they expire."
          }
          actionLabel={showArchived ? undefined : "Add license"}
          onAction={showArchived ? undefined : () => setDialogOpen(true)}
        />
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses.map((license) => (
                <TableRow key={license._id}>
                  <TableCell className="font-medium">{license.name}</TableCell>
                  <TableCell>{license.vendor}</TableCell>
                  <TableCell>{license.seats}</TableCell>
                  <TableCell>
                    {license.cost ? `₹${license.cost.toLocaleString()}` : "—"}
                    {license.cost > 0 && (
                      <span className="text-xs text-muted-foreground"> /{license.billingCycle.replace("_", " ")}</span>
                    )}
                  </TableCell>
                  <TableCell>{fmt(license.startDate)}</TableCell>
                  <TableCell>{fmt(license.expiryDate)}</TableCell>
                  <TableCell>
                    <StatusBadge status={licenseStatus(license)} />
                  </TableCell>
                  <TableCell>{license.assignedTo?.name ?? "Unassigned"}</TableCell>
                  <TableCell>
                    {showArchived ? (
                      <Button variant="outline" size="sm" onClick={() => restore(license._id)}>
                        <ArchiveRestore className="h-4 w-4" />
                        Restore
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(license)
                              setDialogOpen(true)
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-status-danger"
                            onClick={() => setDeleting(license)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <LicenseFormDialog open={dialogOpen} onOpenChange={setDialogOpen} license={editing} onSaved={load} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This license will be archived, not permanently removed. You can restore it later from
              the Archived view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
