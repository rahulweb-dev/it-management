"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Ticket as TicketIcon, Plus } from "lucide-react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/empty-state"
import { TICKET_STATUSES } from "@/lib/constants/enums"
import { slaState } from "@/lib/sla"
import { cn } from "@/lib/utils"
import { TicketFormDialog } from "@/components/tickets/ticket-form-dialog"
import { TicketDetailSheet } from "@/components/tickets/ticket-detail-sheet"

type TicketRow = {
  _id: string
  ticketId: string
  issueType: string
  priority: string
  status: string
  description: string
  slaDeadline: string | null
  createdAt: string
  raisedBy: { name: string } | null
  assignedTo: { name: string } | null
}

export default function TicketsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isItPerson = session?.user.role === "it_person"

  const [tickets, setTickets] = useState<TicketRow[] | null>(null)
  const [status, setStatus] = useState(searchParams.get("status") ?? "all")
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (status !== "all") params.set("status", status)
    const res = await fetch(`/api/tickets?${params.toString()}`)
    if (res.ok) setTickets((await res.json()).items)
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (searchParams.get("new")) {
      setCreateOpen(true)
      router.replace("/tickets")
    }
  }, [searchParams, router])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tickets</h1>
          <p className="text-muted-foreground">
            {isItPerson ? "Every support request across your company." : "Tickets you've raised."}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Raise ticket
        </Button>
      </div>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {TICKET_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {s.replace("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {tickets === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title="No tickets yet"
          description={
            isItPerson
              ? "Support requests from your team will show up here."
              : "Raise a ticket if something's broken or you need IT help."
          }
          actionLabel="Raise ticket"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Raised by</TableHead>
                <TableHead>Assigned to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => {
                const sla = ticket.slaDeadline
                  ? slaState(new Date(ticket.slaDeadline), ticket.priority as any)
                  : "ok"
                const isOpen = !["resolved", "closed"].includes(ticket.status)
                return (
                  <TableRow
                    key={ticket._id}
                    className="cursor-pointer"
                    onClick={() => setSelected(ticket._id)}
                  >
                    <TableCell>
                      <p className="font-medium">{ticket.ticketId}</p>
                      <p className="max-w-xs truncate text-xs text-muted-foreground">
                        {ticket.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.priority} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell>
                      {ticket.slaDeadline && isOpen ? (
                        <span
                          className={cn(
                            "text-xs font-medium",
                            sla === "breached" && "text-status-danger",
                            sla === "due-soon" && "text-status-warning",
                            sla === "ok" && "text-muted-foreground"
                          )}
                        >
                          {sla === "breached" ? "Breached" : formatDistanceToNow(new Date(ticket.slaDeadline), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{ticket.raisedBy?.name ?? "—"}</TableCell>
                    <TableCell>{ticket.assignedTo?.name ?? "Unassigned"}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TicketFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={load} />
      <TicketDetailSheet
        ticketId={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        isItPerson={isItPerson}
        onChanged={load}
      />
    </div>
  )
}
