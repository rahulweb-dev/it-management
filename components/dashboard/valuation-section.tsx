import Link from "next/link"
import { AlertTriangle, IndianRupee, PackageOpen, RefreshCcw, ShieldAlert, TrendingDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatInr, formatInrCompact } from "@/lib/depreciation"
import type { ValuationStats } from "@/lib/dashboard"

type Row = ValuationStats["byType"][number]

function Tile({
  label,
  value,
  detail,
  icon: Icon,
  href,
}: {
  label: string
  value: string
  detail: string
  icon: typeof IndianRupee
  href?: string
}) {
  const body = (
    <Card className={href ? "h-full transition-shadow hover:shadow-md" : "h-full"}>
      <CardContent className="space-y-1 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

/**
 * Single-measure comparison, so one hue: the muted track is purchase cost,
 * the filled part is what's left of it (book value) — same ₹ scale for
 * every row so bars compare across rows. Exact figures sit beside it.
 */
function ValueTable({ title, rows, firstColumn }: { title: string; rows: Row[]; firstColumn: string }) {
  const maxCost = Math.max(1, ...rows.map((r) => r.cost))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-primary" /> Book value
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-muted" /> Purchase cost
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 font-normal">{firstColumn}</th>
              <th className="pb-2 text-right font-normal">Assets</th>
              <th className="hidden w-2/5 pb-2 font-normal sm:table-cell" />
              <th className="pb-2 text-right font-normal">Book value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t">
                <td className="py-2 pr-2">{r.label}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">{r.count}</td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  <div
                    className="relative h-2 rounded-full bg-muted"
                    style={{ width: `${Math.max(2, (r.cost / maxCost) * 100)}%` }}
                    title={`${r.label}: ${formatInr(r.bookValue)} book value of ${formatInr(r.cost)} cost`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary"
                      style={{ width: r.cost > 0 ? `${(r.bookValue / r.cost) * 100}%` : 0 }}
                    />
                  </div>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatInr(r.bookValue)}
                  <span className="block text-xs text-muted-foreground">of {formatInr(r.cost)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

export function ValuationSection({ stats }: { stats: ValuationStats }) {
  const { totals } = stats
  if (totals.activeCount === 0) return null
  const retainedPct = totals.cost > 0 ? Math.round((totals.bookValue / totals.cost) * 100) : 0
  const idle = stats.byStatus.available ?? { count: 0, bookValue: 0 }
  const repair = stats.byStatus.in_repair ?? { count: 0, bookValue: 0 }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Asset value</h2>
        <p className="text-sm text-muted-foreground">
          Book value after depreciation — straight-line over each product type&apos;s useful life, down to a 5% residual.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Current book value"
          value={formatInrCompact(totals.bookValue)}
          detail={`${retainedPct}% of ${formatInrCompact(totals.cost)} purchase cost · ${totals.activeCount} assets`}
          icon={IndianRupee}
        />
        <Tile
          label="Depreciation, last 12 months"
          value={formatInrCompact(totals.depreciationLast12m)}
          detail={`${formatInrCompact(totals.cost - totals.bookValue)} depreciated in total`}
          icon={TrendingDown}
        />
        <Tile
          label="Idle stock"
          value={formatInrCompact(idle.bookValue)}
          detail={`${idle.count} available, unassigned${repair.count ? ` · ${repair.count} in repair (${formatInrCompact(repair.bookValue)})` : ""}`}
          icon={PackageOpen}
          href="/assets?status=available"
        />
        <Tile
          label="Due for replacement"
          value={String(stats.fullyDepreciated)}
          detail={
            stats.warrantyExpiring.count
              ? `fully depreciated · ${stats.warrantyExpiring.count} warranties end within 90 days`
              : "fully depreciated assets"
          }
          icon={RefreshCcw}
        />
      </div>

      {(stats.missingCost > 0 || stats.writtenOff.count > 0) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {stats.missingCost > 0 && (
            <p className="flex items-center gap-1.5 text-status-warning">
              <AlertTriangle className="h-4 w-4" />
              {stats.missingCost} asset{stats.missingCost === 1 ? " has" : "s have"} no purchase cost and count as ₹0 —
              add costs for an accurate total.
            </p>
          )}
          {stats.writtenOff.count > 0 && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <ShieldAlert className="h-4 w-4" />
              {stats.writtenOff.count} disposed/lost asset{stats.writtenOff.count === 1 ? "" : "s"} written off (
              {formatInr(stats.writtenOff.cost)} original cost)
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ValueTable title="By product type" rows={stats.byType} firstColumn="Type" />
        <ValueTable title="By branch" rows={stats.byBranch} firstColumn="Branch" />
      </div>
    </section>
  )
}
