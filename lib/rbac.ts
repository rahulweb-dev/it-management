import type { Role, CompanyRole } from "@/lib/constants/enums"

export type Session = {
  user: {
    id: string
    companyId: string | null
    branchId: string | null
    organizationId: string | null
    role: Role
  }
}

export function isPlatformAdmin(session: Session | null) {
  return session?.user.role === "platform_admin"
}

/**
 * Derives the Mongo filter a company user is allowed to see, purely from
 * the session (never from client input). Every company-scoped list/read
 * API route should spread this into its query. Not meaningful for
 * platform_admin, who operates on the Company collection directly instead.
 */
export function getScopedFilter(session: Session) {
  const { companyId, role, id } = session.user

  if (role === "employee") {
    return { companyId, assignedTo: id }
  }
  // it_person manages everything in their company.
  return { companyId }
}

/**
 * Same idea as getScopedFilter but for tickets: employees see tickets
 * *they raised*, not tickets assigned to them (only it_person gets
 * assigned tickets — employees don't work tickets, they file them).
 */
export function getTicketScopedFilter(session: Session) {
  const { companyId, role, id } = session.user

  if (role === "employee") {
    return { companyId, raisedBy: id }
  }
  return { companyId }
}

const COMPANY_ROLE_RANK: Record<CompanyRole, number> = {
  employee: 0,
  it_person: 1,
}

/** True if the session belongs to a company user at least as privileged as `minRole`. */
export function hasCompanyRole(session: Session | null, minRole: CompanyRole) {
  if (!session || session.user.role === "platform_admin") return false
  return COMPANY_ROLE_RANK[session.user.role] >= COMPANY_ROLE_RANK[minRole]
}

/** Throws if the session isn't a company user with at least `minRole`. */
export function assertCompanyRole(session: Session | null, minRole: CompanyRole) {
  if (!hasCompanyRole(session, minRole)) {
    throw new RbacError(`Requires company role >= ${minRole}`)
  }
}

export function assertPlatformAdmin(session: Session | null) {
  if (!isPlatformAdmin(session)) {
    throw new RbacError("Requires platform admin")
  }
}

export class RbacError extends Error {
  status = 403
}
