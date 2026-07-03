import mongoose, { Schema } from "mongoose"
import { PLANS, SUBSCRIPTION_STATUSES } from "@/lib/constants/enums"

const CompanySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String, default: null },
    // Optional grouping for a holding-company/subsidiary setup — lets one IT
    // Person see across sibling companies without merging their data. Null
    // means this company is standalone (the common case).
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    plan: { type: String, enum: PLANS, default: "starter" },
    subscriptionStatus: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: "trialing",
    },
    trialEndsAt: { type: Date, default: null },
    maxEmployees: { type: Number, default: 10 },
    maxAssets: { type: Number, default: 50 },
    billingEmail: { type: String, default: null },
    // Running total of file storage (QR codes, photos, invoices, ticket
    // attachments) this company has used, in bytes. The limit itself is
    // never stored — see lib/plans.ts, it's always derived from `plan`.
    storageUsedBytes: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export const Company =
  mongoose.models.Company || mongoose.model("Company", CompanySchema)
