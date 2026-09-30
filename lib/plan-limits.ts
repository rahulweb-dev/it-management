import { HttpError } from "@/lib/api"
import { Company } from "@/models/Company"
import { Asset } from "@/models/Asset"
import { User } from "@/models/User"

/**
 * Per-company caps set by the platform admin (Company.maxAssets /
 * maxEmployees). Checked on every path that creates an asset or a user:
 * manual create, invites, onboarding links and device enrollment.
 * Deleted assets and deactivated users don't count toward the cap.
 */

async function loadCompany(companyId: string) {
  const company = await Company.findById(companyId)
  if (!company || company.deletedAt) throw new HttpError("Company not found.", 404)
  if (company.subscriptionStatus === "canceled") {
    throw new HttpError("This company's subscription is inactive. Contact support to reactivate it.", 403)
  }
  return company
}

export async function assertCanAddAssets(companyId: string, count = 1) {
  const company = await loadCompany(companyId)
  const used = await Asset.countDocuments({ companyId })
  if (used + count > company.maxAssets) {
    throw new HttpError(
      `Your plan allows ${company.maxAssets} assets and you have ${used}. Archive unused assets or contact support to raise the limit.`,
      403
    )
  }
}

export async function assertCanAddEmployees(companyId: string, count = 1) {
  const company = await loadCompany(companyId)
  const used = await User.countDocuments({ companyId, isActive: true })
  if (used + count > company.maxEmployees) {
    throw new HttpError(
      `Your plan allows ${company.maxEmployees} active users and you have ${used}. Deactivate someone or contact support to raise the limit.`,
      403
    )
  }
}
