"use client"

import { Search } from "lucide-react"
import { ThemeToggle } from "./theme-toggle"
import { NotificationBell } from "./notification-bell"
import { UserMenu } from "./user-menu"
import { MobileNav } from "./mobile-nav"
import type { Role } from "@/lib/constants/enums"

export function Topbar({
  user,
}: {
  user: { name: string; email: string; avatar: string | null; role: Role }
}) {
  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b bg-background px-4 md:gap-4 md:px-6">
      <MobileNav role={user.role} />
      <button
        onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        className="flex w-full items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted sm:max-w-sm"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">Search assets, tickets, employees...</span>
        <span className="truncate sm:hidden">Search...</span>
        <kbd className="ml-auto hidden shrink-0 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <NotificationBell />
        <UserMenu {...user} />
      </div>
    </header>
  )
}
