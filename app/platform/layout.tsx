import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { Boxes } from "lucide-react"
import { ThemeToggle } from "@/components/dashboard/theme-toggle"
import { UserMenu } from "@/components/dashboard/user-menu"

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || session.user.role !== "platform_admin") redirect("/login")

  const { name, email, avatar } = session.user

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <Boxes className="h-5 w-5 text-primary" />
          AssetFlow Platform
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu name={name} email={email} avatar={avatar} role="platform_admin" />
        </div>
      </header>
      <main className="flex-1 bg-muted/20 p-4 md:p-6">{children}</main>
    </div>
  )
}
