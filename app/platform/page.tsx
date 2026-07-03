"use client"

import { useCallback, useEffect, useState } from "react"
import { Building2, Plus } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/empty-state"
import { StorageUsageBar } from "@/components/storage-usage-bar"
import { PLANS } from "@/lib/constants/enums"
import { CompanyFormDialog } from "@/components/platform/company-form-dialog"

type CompanyRow = {
  _id: string
  name: string
  slug: string
  plan: string
  subscriptionStatus: string
  createdAt: string
  userCount: number
  itPerson: { name: string; email: string } | null
  storage: { usedGb: number; limitGb: number; percentUsed: number }
  organizationId: { _id: string; name: string } | null
}

export default function PlatformPage() {
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/companies")
    if (res.ok) {
      const data = await res.json()
      setCompanies(data.items)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleStatus(company: CompanyRow) {
    const next = company.subscriptionStatus === "canceled" ? "active" : "canceled"
    const res = await fetch(`/api/platform/companies/${company._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionStatus: next }),
    })
    if (!res.ok) {
      toast.error("Failed to update company")
      return
    }
    toast.success(next === "canceled" ? "Company deactivated" : "Company activated")
    load()
  }

  async function changePlan(company: CompanyRow, plan: string) {
    const res = await fetch(`/api/platform/companies/${company._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    })
    if (!res.ok) {
      toast.error("Failed to change plan")
      return
    }
    toast.success(`Plan changed to ${plan}`)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-muted-foreground">Every tenant on AssetFlow.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Create company
        </Button>
      </div>

      {companies === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Create the first company workspace and its IT Person account to get started."
          actionLabel="Create company"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>IT Person</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Users</TableHead>
                <TableHead className="w-24">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company._id}>
                  <TableCell className="font-medium">
                    {company.name}
                    {company.organizationId && (
                      <p className="text-xs font-normal text-muted-foreground">
                        {company.organizationId.name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {company.itPerson ? (
                      <div>
                        <p>{company.itPerson.name}</p>
                        <p className="text-xs text-muted-foreground">{company.itPerson.email}</p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Select value={company.plan} onValueChange={(plan) => changePlan(company, plan)}>
                      <SelectTrigger className="w-28 capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLANS.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <StorageUsageBar
                      usedGb={company.storage.usedGb}
                      limitGb={company.storage.limitGb}
                      percentUsed={company.storage.percentUsed}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={company.subscriptionStatus} />
                  </TableCell>
                  <TableCell>{company.userCount}</TableCell>
                  <TableCell>
                    <Switch
                      checked={company.subscriptionStatus !== "canceled"}
                      onCheckedChange={() => toggleStatus(company)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CompanyFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
    </div>
  )
}
