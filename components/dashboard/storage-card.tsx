import { HardDrive } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export function StorageCard({
  plan,
  usedGb,
  limitGb,
  remainingGb,
  percentUsed,
}: {
  plan: string
  usedGb: number
  limitGb: number
  remainingGb: number
  percentUsed: number
}) {
  const tone = percentUsed >= 100 ? "danger" : percentUsed >= 80 ? "warning" : "success"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <HardDrive className="h-4 w-4" />
          Storage — <span className="capitalize">{plan}</span> plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress
          value={Math.min(100, percentUsed)}
          className={cn(
            "h-2",
            tone === "danger" && "**:data-[slot=progress-indicator]:bg-status-danger",
            tone === "warning" && "**:data-[slot=progress-indicator]:bg-status-warning",
            tone === "success" && "**:data-[slot=progress-indicator]:bg-status-success"
          )}
        />
        <p className="text-sm text-muted-foreground">
          {usedGb} GB used of {limitGb} GB —{" "}
          <span
            className={cn(
              "font-medium",
              tone === "danger" && "text-status-danger",
              tone === "warning" && "text-status-warning"
            )}
          >
            {remainingGb} GB left
          </span>
        </p>
        {tone === "danger" && (
          <p className="text-xs text-status-danger">
            Storage limit reached — new uploads (QR codes, photos, invoices) will be blocked until you free up space or upgrade.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
