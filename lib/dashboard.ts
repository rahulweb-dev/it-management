import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { Ticket } from "@/models/Ticket"
import { Branch } from "@/models/Branch"
import { User } from "@/models/User"
import { getScopedFilter, type Session } from "@/lib/rbac"
import { valueAsset, type DepreciableAsset } from "@/lib/depreciation"
import { PRODUCT_TYPES, resolveProductType } from "@/lib/constants/product-types"

// Both functions below assume a company session (role !== "platform_admin"),
// which callers must check before invoking — companyId is guaranteed non-null there.

export async function getOrgDashboardStats(session: Session) {
  await connectDB()
  const filter = getScopedFilter(session)
  const companyId = session.user.companyId!

  const [
    totalAssets,
    availableAssets,
    assignedAssets,
    inRepairAssets,
    disposedAssets,
    openTickets,
    criticalTickets,
    branchCount,
    employeeCount,
  ] = await Promise.all([
    Asset.countDocuments(filter),
    Asset.countDocuments({ ...filter, status: "available" }),
    Asset.countDocuments({ ...filter, status: "assigned" }),
    Asset.countDocuments({ ...filter, status: "in_repair" }),
    Asset.countDocuments({ ...filter, status: "disposed" }),
    Ticket.countDocuments({ ...filter, status: { $in: ["open", "assigned", "in_progress"] } }),
    Ticket.countDocuments({ ...filter, status: { $in: ["open", "assigned", "in_progress"] }, priority: "critical" }),
    Branch.countDocuments({ companyId }),
    User.countDocuments({ companyId, isActive: true }),
  ])

  return {
    totalAssets,
    availableAssets,
    assignedAssets,
    inRepairAssets,
    disposedAssets,
    openTickets,
    criticalTickets,
    branchCount,
    employeeCount,
    onboarding: {
      hasBranch: branchCount > 0,
      hasEmployees: employeeCount > 1,
      hasAssets: totalAssets > 0,
    },
  }
}

export async function getEmployeeDashboardStats(session: Session) {
  await connectDB()
  const { id } = session.user
  const companyId = session.user.companyId!

  const [myAssets, myOpenTickets] = await Promise.all([
    Asset.countDocuments({ companyId, assignedTo: id }),
    Ticket.countDocuments({ companyId, raisedBy: id, status: { $in: ["open", "assigned", "in_progress"] } }),
  ])

  return { myAssets, myOpenTickets }
}

type ValueRow = { key: string; label: string; count: number; cost: number; bookValue: number }

function addTo(map: Map<string, ValueRow>, key: string, label: string, cost: number, bookValue: number) {
  const row = map.get(key) ?? { key, label, count: 0, cost: 0, bookValue: 0 }
  row.count += 1
  row.cost += cost
  row.bookValue += bookValue
  map.set(key, row)
}

/**
 * What the company's hardware is worth, computed live from each asset's
 * cost, age and product-type useful life (see lib/depreciation.ts). Loads
 * only the handful of fields valuation needs, so it stays cheap into the
 * low tens of thousands of assets.
 */
export async function getValuationStats(session: Session) {
  await connectDB()
  const filter = getScopedFilter(session)
  const companyId = session.user.companyId!

  const [assets, branches] = await Promise.all([
    Asset.find(filter)
      .select("purchaseCost purchaseDate createdAt depreciationRate productType category status branchId warrantyExpiry")
      .lean<(DepreciableAsset & { branchId: unknown; warrantyExpiry: Date | null })[]>(),
    Branch.find({ companyId }).select("name").lean<{ _id: unknown; name: string }[]>(),
  ])
  const branchNames = new Map(branches.map((b) => [String(b._id), b.name]))

  const now = new Date()
  const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const byType = new Map<string, ValueRow>()
  const byBranch = new Map<string, ValueRow>()
  const totals = { cost: 0, bookValue: 0, depreciationLast12m: 0, activeCount: 0 }
  const byStatus: Record<string, { count: number; bookValue: number }> = {}
  const writtenOff = { count: 0, cost: 0 }
  let fullyDepreciated = 0
  let missingCost = 0
  const warrantyExpiring = { count: 0, bookValue: 0 }

  for (const a of assets) {
    const v = valueAsset(a, now)
    if (v.method === "written_off") {
      writtenOff.count += 1
      writtenOff.cost += v.cost
      continue
    }
    totals.activeCount += 1
    totals.cost += v.cost
    totals.bookValue += v.bookValue
    totals.depreciationLast12m += valueAsset(a, yearAgo).bookValue - v.bookValue
    if (v.cost === 0) missingCost += 1
    if (v.fullyDepreciated) fullyDepreciated += 1

    const status = a.status ?? "available"
    byStatus[status] ??= { count: 0, bookValue: 0 }
    byStatus[status].count += 1
    byStatus[status].bookValue += v.bookValue

    const type = resolveProductType(a)
    addTo(byType, type, PRODUCT_TYPES[type].label, v.cost, v.bookValue)
    const branchKey = String(a.branchId ?? "")
    addTo(byBranch, branchKey, branchNames.get(branchKey) ?? "Unknown branch", v.cost, v.bookValue)

    if (a.warrantyExpiry && a.warrantyExpiry >= now && a.warrantyExpiry <= in90Days) {
      warrantyExpiring.count += 1
      warrantyExpiring.bookValue += v.bookValue
    }
  }

  const sorted = (m: Map<string, ValueRow>) => [...m.values()].sort((x, y) => y.bookValue - x.bookValue || y.count - x.count)

  return {
    totals,
    byType: sorted(byType),
    byBranch: sorted(byBranch),
    byStatus,
    writtenOff,
    fullyDepreciated,
    missingCost,
    warrantyExpiring,
  }
}

export type ValuationStats = Awaited<ReturnType<typeof getValuationStats>>
