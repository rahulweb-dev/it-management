import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export function StorageUsageBar({
  usedGb,
  limitGb,
  percentUsed,
  className,
}: {
  usedGb: number
  limitGb: number
  percentUsed: number
  className?: string
}) {
  const tone = percentUsed >= 100 ? "danger" : percentUsed >= 80 ? "warning" : "success"

  return (
    <div className={cn("w-40 space-y-1", className)}>
      <Progress
        value={Math.min(100, percentUsed)}
        className={cn(
          "h-1.5",
          tone === "danger" && "**:data-[slot=progress-indicator]:bg-status-danger",
          tone === "warning" && "**:data-[slot=progress-indicator]:bg-status-warning",
          tone === "success" && "**:data-[slot=progress-indicator]:bg-status-success"
        )}
      />
      <p className="text-xs text-muted-foreground">
        {usedGb} GB of {limitGb} GB ({percentUsed}%)
      </p>
    </div>
  )
}
