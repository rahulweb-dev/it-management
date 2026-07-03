import Link from "next/link"
import { Check, Circle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Step = { label: string; href: string; done: boolean }

export function OnboardingChecklist({
  hasBranch,
  hasEmployees,
  hasAssets,
}: {
  hasBranch: boolean
  hasEmployees: boolean
  hasAssets: boolean
}) {
  const steps: Step[] = [
    { label: "Add your first branch", href: "/branches", done: hasBranch },
    { label: "Add employees", href: "/employees", done: hasEmployees },
    { label: "Add assets", href: "/assets", done: hasAssets },
  ]

  if (steps.every((s) => s.done)) return null

  return (
    <Card className="border-status-info/30 bg-status-info/5">
      <CardHeader>
        <CardTitle className="text-base">Get your workspace ready</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row sm:gap-4">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:border-primary/50",
              step.done && "text-muted-foreground"
            )}
          >
            {step.done ? (
              <Check className="h-4 w-4 text-status-success" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            {step.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
