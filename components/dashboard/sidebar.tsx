import type { Role } from "@/lib/constants/enums"
import { SidebarNav } from "./sidebar-nav"

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <SidebarNav role={role} />
    </aside>
  )
}
