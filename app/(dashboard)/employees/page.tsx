"use client"

import { useCallback, useEffect, useState } from "react"
import { Users, Plus, MoreHorizontal, Copy, UserPlus, Link as LinkIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/empty-state"
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog"
import { InviteEmployeeDialog } from "@/components/employees/invite-employee-dialog"

type Employee = {
  _id: string
  employeeCode: string | null
  name: string
  email: string
  role: string
  department: string | null
  isActive: boolean
  branchId: { _id: string; name: string } | null
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[] | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [linkDialog, setLinkDialog] = useState<{ title: string; description: string; link: string; revocable?: boolean } | null>(
    null
  )

  const load = useCallback(async () => {
    const res = await fetch("/api/employees")
    if (res.ok) {
      const data = await res.json()
      setEmployees(data.items)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleActive(employee: Employee) {
    const res = await fetch(`/api/employees/${employee._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !employee.isActive }),
    })
    if (!res.ok) {
      toast.error("Failed to update employee")
      return
    }
    toast.success(
      employee.isActive
        ? "Employee deactivated — their assets have been returned to available"
        : "Employee reactivated"
    )
    load()
  }

  async function getOnboardingLink() {
    const res = await fetch("/api/employees/onboarding-link", { method: "POST" })
    if (!res.ok) {
      toast.error("Failed to create onboarding link")
      return
    }
    const data = await res.json()
    setLinkDialog({
      title: "Company onboarding link",
      description:
        "Share this with everyone — Slack, email blast, notice board. Anyone who opens it fills in their own Employee ID, name, password, and branch, then gets walked straight into registering their computer. Works for 90 days, reusable by any number of people. Any link generated earlier has now stopped working.",
      link: data.link,
      revocable: true,
    })
  }

  async function revokeOnboardingLink() {
    const res = await fetch("/api/employees/onboarding-link", { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to disable the link")
      return
    }
    toast.success("Onboarding link disabled — nobody new can sign up with it")
    setLinkDialog(null)
  }

  async function sendInstallLink(employee: Employee) {
    const res = await fetch(`/api/employees/${employee._id}/agent-link`, { method: "POST" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Failed to create install link")
      return
    }
    const data = await res.json()
    setLinkDialog({
      title: "Device install link",
      description:
        "Emailed to the employee. It works once and expires in 48 hours — you can also copy it below and send it yourself.",
      link: data.link,
    })
    toast.success(`Install link emailed to ${employee.email}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-muted-foreground">Everyone with access to AssetFlow at your company.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={getOnboardingLink}>
            <LinkIcon className="h-4 w-4" />
            New onboarding link
          </Button>
          <Button variant="outline" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Invite employee
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add employee
          </Button>
        </div>
      </div>

      {employees === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="Add employees so they can sign in, view their assets, and raise support tickets."
          actionLabel="Add employee"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const initials = employee.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
                return (
                  <TableRow key={employee._id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {employee.employeeCode ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">{employee.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{employee.role.replace("_", " ")}</TableCell>
                    <TableCell>{employee.branchId?.name ?? "—"}</TableCell>
                    <TableCell>{employee.department || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          employee.isActive
                            ? "border-status-success/30 bg-status-success/15 text-status-success"
                            : "border-status-danger/30 bg-status-danger/15 text-status-danger"
                        }
                      >
                        {employee.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => sendInstallLink(employee)}>
                            Send device install link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive(employee)}>
                            {employee.isActive ? "Deactivate" : "Reactivate"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EmployeeFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />

      <InviteEmployeeDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={(link) => {
          setLinkDialog({
            title: "Employee invite link",
            description:
              "Emailed to them. It works once and expires in 7 days — you can also copy it below and send it yourself.",
            link,
          })
          toast.success("Invite sent")
        }}
      />

      <Dialog open={!!linkDialog} onOpenChange={(open) => !open && setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{linkDialog?.title}</DialogTitle>
            <DialogDescription>{linkDialog?.description}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={linkDialog?.link ?? ""} onFocus={(e) => e.target.select()} />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                if (linkDialog?.link) navigator.clipboard.writeText(linkDialog.link)
                toast.success("Copied")
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {linkDialog?.revocable && (
            <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
              Link shared somewhere it shouldn&apos;t be?
              <Button type="button" variant="outline" size="sm" onClick={revokeOnboardingLink}>
                Disable link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
