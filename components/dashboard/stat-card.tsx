import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export function StatCard({
  label,
  value,
  href,
  icon: Icon,
  tone = "info",
}: {
  label: string
  value: number
  href: string
  icon: LucideIcon
  tone?: "success" | "info" | "warning" | "danger"
}) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              tone === "success" && "bg-status-success/15 text-status-success",
              tone === "info" && "bg-status-info/15 text-status-info",
              tone === "warning" && "bg-status-warning/15 text-status-warning",
              tone === "danger" && "bg-status-danger/15 text-status-danger"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
