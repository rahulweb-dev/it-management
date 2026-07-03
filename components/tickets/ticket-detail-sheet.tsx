"use client"

import { useCallback, useEffect, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/status-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TICKET_STATUSES } from "@/lib/constants/enums"
import { slaState } from "@/lib/sla"
import { cn } from "@/lib/utils"

type Comment = {
  _id: string
  userId: { name: string; email: string } | null
  message: string
  timestamp: string
}

type TicketDetail = {
  _id: string
  ticketId: string
  issueType: string
  priority: string
  status: string
  description: string
  slaDeadline: string | null
  raisedBy: { _id: string; name: string; email: string } | null
  assignedTo: { _id: string; name: string; email: string } | null
  relatedAssetId: { assetName: string; assetId: string } | null
  comments: Comment[]
}

type ItPerson = { _id: string; name: string; email: string }

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

export function TicketDetailSheet({
  ticketId,
  open,
  onOpenChange,
  isItPerson,
  onChanged,
}: {
  ticketId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isItPerson: boolean
  onChanged: () => void
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [itPeople, setItPeople] = useState<ItPerson[]>([])
  const [comment, setComment] = useState("")
  const [posting, setPosting] = useState(false)

  const load = useCallback(async () => {
    if (!ticketId) return
    const res = await fetch(`/api/tickets/${ticketId}`)
    if (res.ok) setTicket((await res.json()).item)
  }, [ticketId])

  useEffect(() => {
    if (open) {
      load()
      if (isItPerson) {
        fetch("/api/employees")
          .then((res) => res.json())
          .then((data) => setItPeople((data.items ?? []).filter((u: any) => u.role === "it_person")))
      }
    }
  }, [open, load, isItPerson])

  async function changeStatus(status: string) {
    if (!ticketId) return
    const res = await fetch(`/api/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      toast.error("Failed to update status")
      return
    }
    toast.success("Status updated")
    load()
    onChanged()
  }

  async function assignTo(assignedTo: string) {
    if (!ticketId) return
    const res = await fetch(`/api/tickets/${ticketId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedTo }),
    })
    if (!res.ok) {
      toast.error("Failed to assign ticket")
      return
    }
    toast.success("Ticket assigned")
    load()
    onChanged()
  }

  async function submitComment() {
    if (!ticketId || !comment.trim()) return
    setPosting(true)
    // Optimistic UI — the thread should feel instant, per the polish spec.
    const optimistic: Comment = {
      _id: `optimistic-${Date.now()}`,
      userId: { name: "You", email: "" },
      message: comment,
      timestamp: new Date().toISOString(),
    }
    setTicket((prev) => (prev ? { ...prev, comments: [...prev.comments, optimistic] } : prev))
    const message = comment
    setComment("")

    const res = await fetch(`/api/tickets/${ticketId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
    setPosting(false)

    if (!res.ok) {
      toast.error("Failed to post comment")
      load()
      return
    }
    load()
  }

  const sla = ticket?.slaDeadline ? slaState(new Date(ticket.slaDeadline), ticket.priority as any) : "ok"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        {!ticket ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{ticket.ticketId}</SheetTitle>
              <SheetDescription className="capitalize">{ticket.issueType} issue</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={ticket.status} />
                <StatusBadge status={ticket.priority} label={`${ticket.priority} priority`} />
                {ticket.slaDeadline && (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs font-medium",
                      sla === "breached" && "border-status-danger/30 bg-status-danger/15 text-status-danger",
                      sla === "due-soon" && "border-status-warning/30 bg-status-warning/15 text-status-warning",
                      sla === "ok" && "border-status-success/30 bg-status-success/15 text-status-success"
                    )}
                  >
                    {sla === "breached" ? "SLA breached" : `SLA due ${formatDistanceToNow(new Date(ticket.slaDeadline), { addSuffix: true })}`}
                  </span>
                )}
              </div>

              <p className="text-sm">{ticket.description}</p>

              {ticket.relatedAssetId && (
                <p className="text-xs text-muted-foreground">
                  Related asset: {ticket.relatedAssetId.assetName} ({ticket.relatedAssetId.assetId})
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Raised by</p>
                  <p>{ticket.raisedBy?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assigned to</p>
                  <p>{ticket.assignedTo?.name ?? "Unassigned"}</p>
                </div>
              </div>

              {isItPerson && (
                <div className="flex flex-wrap gap-3">
                  <Select value={ticket.status} onValueChange={changeStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={ticket.assignedTo?._id ?? ""} onValueChange={assignTo}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Assign to..." />
                    </SelectTrigger>
                    <SelectContent>
                      {itPeople.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Comments</h3>
                {ticket.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : (
                  ticket.comments.map((c) => (
                    <div key={c._id} className="flex gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {initials(c.userId?.name ?? "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-medium">{c.userId?.name ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(c.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                        <p className="text-sm">{c.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-auto flex gap-2 border-t p-4">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment..."
                rows={1}
                className="min-h-9 resize-none"
              />
              <Button onClick={submitComment} disabled={posting || !comment.trim()}>
                Send
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
