"use client"

import { useCallback, useEffect, useState } from "react"
import { Building2, Plus, MoreHorizontal, Archive, ArchiveRestore } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { EmptyState } from "@/components/empty-state"
import { BranchFormDialog, type BranchRecord } from "@/components/branches/branch-form-dialog"

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchRecord[] | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BranchRecord | null>(null)
  const [deleting, setDeleting] = useState<BranchRecord | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/branches${showArchived ? "?archived=true" : ""}`)
    if (res.ok) {
      const data = await res.json()
      setBranches(data.items)
    }
  }, [showArchived])

  useEffect(() => {
    load()
  }, [load])

  async function confirmDelete() {
    if (!deleting) return
    const res = await fetch(`/api/branches/${deleting._id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to delete branch")
    } else {
      toast.success("Branch deleted")
      load()
    }
    setDeleting(null)
  }

  async function restore(branchId: string) {
    const res = await fetch(`/api/branches/${branchId}/restore`, { method: "POST" })
    if (!res.ok) {
      toast.error("Failed to restore branch")
      return
    }
    toast.success("Branch restored")
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{showArchived ? "Archived branches" : "Branches"}</h1>
          <p className="text-muted-foreground">
            {showArchived
              ? "Deleted branches — restore one to bring it back."
              : "Locations your company operates assets and staff from."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? (
              <>
                <Building2 className="h-4 w-4" />
                Back to branches
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
              Add branch
            </Button>
          )}
        </div>
      </div>

      {branches === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : branches.length === 0 ? (
        <EmptyState
          icon={showArchived ? Archive : Building2}
          title={showArchived ? "No archived branches" : "No branches yet"}
          description={
            showArchived
              ? "Deleted branches will show up here so you can restore them if needed."
              : "Add your first branch to start assigning assets and employees to a location."
          }
          actionLabel={showArchived ? undefined : "Add branch"}
          onAction={showArchived ? undefined : () => setDialogOpen(true)}
        />
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch: any) => (
                <TableRow key={branch._id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>{branch.city || "—"}</TableCell>
                  <TableCell>{branch.country || "—"}</TableCell>
                  <TableCell>{branch.managerId?.name ?? "Unassigned"}</TableCell>
                  <TableCell>
                    {showArchived ? (
                      <Button variant="outline" size="sm" onClick={() => restore(branch._id)}>
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
                              setEditing(branch)
                              setDialogOpen(true)
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-status-danger"
                            onClick={() => setDeleting(branch)}
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

      <BranchFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        branch={editing}
        onSaved={load}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This branch will be archived. Assets and employees already assigned to it keep their
              record but you won&apos;t be able to assign new ones here. You can restore it later
              from the Archived view.
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
