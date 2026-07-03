import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import { CommandPalette } from "@/components/dashboard/command-palette"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const { role, name, email, avatar } = session.user

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={{ name, email, avatar, role }} />
        <main className="flex-1 overflow-x-hidden bg-muted/20 p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette role={role} />
    </div>
  )
}
