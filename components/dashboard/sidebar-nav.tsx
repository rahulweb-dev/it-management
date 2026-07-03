"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Boxes } from "lucide-react"
import { NAV_ITEMS } from "./nav-items"
import type { Role } from "@/lib/constants/enums"
import { cn } from "@/lib/utils"

/** The actual nav list — shared by the fixed desktop sidebar and the mobile slide-out drawer. */
export function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b px-5 font-semibold">
        <Boxes className="h-5 w-5 text-primary" />
        AssetFlow
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
