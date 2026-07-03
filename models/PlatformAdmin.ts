import mongoose, { Schema } from "mongoose"

/**
 * Platform-level account, separate from the tenant-scoped User collection
 * on purpose: it has no companyId and manages the list of companies
 * itself, so it can't go through the tenant-guard plugin (which requires
 * companyId on every query). Created only via the seed script — there is
 * no public signup path for this role.
 */
const PlatformAdminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
)

export const PlatformAdmin =
  mongoose.models.PlatformAdmin || mongoose.model("PlatformAdmin", PlatformAdminSchema)
