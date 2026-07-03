"use client"

import { useEffect, useState, useCallback } from "react"
import { Bell } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

type NotificationItem = {
  _id: string
  type: string
  message: string
  isRead: boolean
  link: string | null
  createdAt: string
}

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications")
    if (!res.ok) return
    const data = await res.json()
    setItems(data.items)
    setUnreadCount(data.unreadCount)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  async function markAllRead() {
    setUnreadCount(0)
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
    await fetch("/api/notifications", { method: "PATCH", body: "{}" })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full bg-status-danger px-1 text-status-danger-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-auto p-0 text-xs">
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            items.map((n) => (
              <Link
                key={n._id}
                href={n.link ?? "#"}
                onClick={() => setOpen(false)}
                className="block border-b px-4 py-3 text-sm last:border-0 hover:bg-muted/50"
              >
                <p className={n.isRead ? "text-muted-foreground" : "font-medium"}>{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </Link>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
