import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"
import { BILLING_CYCLES } from "@/lib/constants/enums"

const LicenseSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    name: { type: String, required: true, trim: true },
    vendor: { type: String, required: true, trim: true },
    licenseKey: { type: String, default: null },
    seats: { type: Number, default: 1, min: 1 },
    cost: { type: Number, default: 0, min: 0 },
    billingCycle: { type: String, enum: BILLING_CYCLES, default: "yearly" },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    // How many days before expiryDate the cron job (app/api/cron/expiry-check)
    // should notify the IT team — also drives the "expiring soon" badge.
    reminderDaysBefore: { type: Number, default: 30, min: 1, max: 365 },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: null },
    cancelled: { type: Boolean, default: false },
    // Set by the expiry-check cron once a reminder goes out, so it isn't
    // re-sent every day for the rest of the reminder window. Cleared
    // whenever expiryDate changes (see app/api/licenses/[id]/route.ts).
    lastReminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
)

LicenseSchema.index({ companyId: 1, expiryDate: 1 })

LicenseSchema.plugin(tenantScoped)

export const License =
  mongoose.models.License || mongoose.model("License", LicenseSchema)
