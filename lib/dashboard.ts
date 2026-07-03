import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { Ticket } from "@/models/Ticket"
import { Branch } from "@/models/Branch"
import { User } from "@/models/User"
import { getScopedFilter, type Session } from "@/lib/rbac"

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
