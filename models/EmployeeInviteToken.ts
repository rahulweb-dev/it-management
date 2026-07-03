import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"

/**
 * Two shapes share this collection:
 *
 * 1. Per-person invite (email set) — IT invites one specific new hire,
 *    single-use (usedAt gets set once they onboard).
 * 2. Company-wide onboarding link (email null) — a single reusable link
 *    IT shares with everyone at once (Slack, notice board, etc). Anyone
 *    with the link supplies their own email during onboarding, and it's
 *    never marked "used" so the same link works for every new hire until
 *    it expires.
 */
const EmployeeInviteTokenSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

EmployeeInviteTokenSchema.plugin(tenantScoped)

export const EmployeeInviteToken =
  mongoose.models.EmployeeInviteToken ||
  mongoose.model("EmployeeInviteToken", EmployeeInviteTokenSchema)
