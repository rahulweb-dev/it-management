import { Badge } from "@/components/ui/badge"
import { classesForStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string
  label?: string
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize font-medium", classesForStatus(status), className)}
    >
      {(label ?? status).replace(/_/g, " ")}
    </Badge>
  )
}
