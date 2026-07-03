import { Company } from "@/models/Company"
import { Asset } from "@/models/Asset"
import { RbacError, type Session } from "@/lib/rbac"

/**
 * Companies sharing an organizationId are still fully separate tenants —
 * this only tells us which sibling companyIds an IT Person is allowed to
 * read across / create an asset in. Every actual data query still filters
 * by companyId (or companyId: {$in: siblingIds}), it's never bypassed.
 */
export async function getOrganizationCompanies(organizationId: string) {
  return Company.find({ organizationId, deletedAt: null })
    .select("_id name slug")
    .setOptions({ skipTenantGuard: true })
    .sort({ name: 1 })
}

export async function getOrganizationCompanyIds(organizationId: string) {
  const companies = await getOrganizationCompanies(organizationId)
  return companies.map((c: any) => c._id.toString())
}

/**
 * Every companyId a session is allowed to read/manage assets under.
 * it_person with an organization gets every sibling (including their own
 * company, since getOrganizationCompanyIds includes it); everyone else —
 * employees, or an it_person with no organization — is limited to their
 * own single company.
 */
export async function getAccessibleCompanyIds(session: Session) {
  if (session.user.role === "it_person" && session.user.organizationId) {
    return getOrganizationCompanyIds(session.user.organizationId)
  }
  return session.user.companyId ? [session.user.companyId] : []
}

/**
 * Looks up an asset the session is allowed to manage, across every
 * accessible company — used by asset detail/edit/assign/photo routes so
 * an it_person's organization-wide access is enforced the same way
 * everywhere instead of each route re-deriving it. Returns null (never
 * throws) when not found or not accessible, same as a plain findOne.
 */
export async function findAccessibleAsset(
  session: Session,
  id: string,
  extraFilter: Record<string, any> = {}
) {
  const companyIds = await getAccessibleCompanyIds(session)
  if (companyIds.length === 0) return null
  return Asset.findOne({ _id: id, companyId: { $in: companyIds }, ...extraFilter })
}

/**
 * Confirms `targetCompanyId` is actually one of the session's own
 * organization's companies before letting a request act on it — the
 * organizationId in the JWT is trustworthy (server-issued), but the
 * targetCompanyId in a request body is client input and must be verified
 * against real data, not just compared to a string the client could forge.
 */
export async function assertCompanyInOrganization(organizationId: string | null, targetCompanyId: string) {
  if (!organizationId) {
    throw new RbacError("You don't have access to other companies.")
  }
  const company = await Company.findOne({
    _id: targetCompanyId,
    organizationId,
    deletedAt: null,
  }).setOptions({ skipTenantGuard: true })

  if (!company) {
    throw new RbacError("That company isn't part of your organization.")
  }
  return company
}
