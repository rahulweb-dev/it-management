import { Boxes, CheckCircle2, Wrench, Ticket as TicketIcon, Building2, Users } from "lucide-react"
import { auth } from "@/auth"
import { getOrgDashboardStats, getEmployeeDashboardStats, getValuationStats } from "@/lib/dashboard"
import { getStorageStatus } from "@/lib/storage"
import { StatCard } from "@/components/dashboard/stat-card"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"
import { StorageCard } from "@/components/dashboard/storage-card"
import { ValuationSection } from "@/components/dashboard/valuation-section"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) return null

  if (session.user.role === "employee") {
    const stats = await getEmployeeDashboardStats(session)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-muted-foreground">Here&apos;s what&apos;s assigned to you.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="My Assets" value={stats.myAssets} href="/assets" icon={Boxes} tone="info" />
          <StatCard
            label="My Open Tickets"
            value={stats.myOpenTickets}
            href="/tickets"
            icon={TicketIcon}
            tone="warning"
          />
        </div>
      </div>
    )
  }

  const [stats, storage, valuation] = await Promise.all([
    getOrgDashboardStats(session),
    getStorageStatus(session.user.companyId!),
    getValuationStats(session),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">A live view of your organization&apos;s assets and tickets.</p>
      </div>

      <StorageCard
        plan={storage.plan}
        usedGb={storage.usedGb}
        limitGb={storage.limitGb}
        remainingGb={storage.remainingGb}
        percentUsed={storage.percentUsed}
      />

      <OnboardingChecklist
        hasBranch={stats.onboarding.hasBranch}
        hasEmployees={stats.onboarding.hasEmployees}
        hasAssets={stats.onboarding.hasAssets}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Assets" value={stats.totalAssets} href="/assets" icon={Boxes} tone="info" />
        <StatCard
          label="Available"
          value={stats.availableAssets}
          href="/assets?status=available"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="In Repair"
          value={stats.inRepairAssets}
          href="/assets?status=in_repair"
          icon={Wrench}
          tone="warning"
        />
        <StatCard
          label="Open Tickets"
          value={stats.openTickets}
          href="/tickets?status=open"
          icon={TicketIcon}
          tone={stats.criticalTickets > 0 ? "danger" : "info"}
        />
        <StatCard label="Assigned" value={stats.assignedAssets} href="/assets?status=assigned" icon={Boxes} tone="info" />
        <StatCard label="Disposed" value={stats.disposedAssets} href="/assets?status=disposed" icon={Boxes} tone="danger" />
        <StatCard label="Branches" value={stats.branchCount} href="/branches" icon={Building2} tone="info" />
        <StatCard label="Employees" value={stats.employeeCount} href="/employees" icon={Users} tone="info" />
      </div>

      <ValuationSection stats={valuation} />
    </div>
  )
}
