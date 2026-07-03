import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"

/**
 * One-time, single-use link an IT Person sends to an employee so they can
 * install the hardware-inventory agent on their own machine. Only the
 * token's hash is stored (same pattern as password-reset tokens) — the
 * raw token lives in the emailed URL and is never persisted.
 */
const DeviceEnrollmentTokenSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

DeviceEnrollmentTokenSchema.plugin(tenantScoped)

export const DeviceEnrollmentToken =
  mongoose.models.DeviceEnrollmentToken ||
  mongoose.model("DeviceEnrollmentToken", DeviceEnrollmentTokenSchema)
