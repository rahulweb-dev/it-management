import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"
import { ASSET_STATUSES, ASSET_CONDITIONS } from "@/lib/constants/enums"

// Auto-collected by the installed agent (PowerShell on Windows, shell
// script on Mac) — see lib/agent/*. Only present once an employee has
// actually installed the agent on this asset; absent for manually
// entered assets. `deviceApiKeyHash` authenticates check-ins, never the
// raw key (same pattern as password hashing).
const AgentInfoSchema = new Schema(
  {
    enrolled: { type: Boolean, default: false },
    deviceApiKeyHash: { type: String, default: null },
    hostname: { type: String, default: null },
    cpu: { type: String, default: null },
    ramGb: { type: Number, default: null },
    storageGb: { type: Number, default: null },
    os: { type: String, default: null },
    ipAddress: { type: String, default: null },
    macAddress: { type: String, default: null },
    loggedInUser: { type: String, default: null },
    agentPlatform: { type: String, enum: ["windows", "mac"], default: null },
    lastCheckInAt: { type: Date, default: null },
  },
  { _id: false }
)

const AssetSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    assetId: { type: String, required: true },
    assetName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    serialNumber: { type: String, default: null, trim: true },
    brand: { type: String, default: null },
    model: { type: String, default: null },
    purchaseDate: { type: Date, default: null },
    purchaseCost: { type: Number, default: 0 },
    vendor: { type: String, default: null },
    invoiceUrl: { type: String, default: null },
    warrantyExpiry: { type: Date, default: null },
    amcExpiry: { type: Date, default: null },
    // Set once the expiry-check cron (app/api/cron/expiry-check) has sent a
    // reminder for the current warrantyExpiry/amcExpiry, so it doesn't
    // re-notify every day. Cleared whenever the corresponding date changes.
    warrantyReminderSentAt: { type: Date, default: null },
    amcReminderSentAt: { type: Date, default: null },
    status: { type: String, enum: ASSET_STATUSES, default: "available" },
    condition: { type: String, enum: ASSET_CONDITIONS, default: "new" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    location: { type: String, default: null },
    qrCodeUrl: { type: String, default: null },
    photos: { type: [String], default: [] },
    depreciationRate: { type: Number, default: 0 },
    currentValue: { type: Number, default: 0 },
    agent: { type: AgentInfoSchema, default: () => ({}) },
  },
  { timestamps: true }
)

AssetSchema.index({ companyId: 1, assetId: 1 }, { unique: true })
AssetSchema.index({ companyId: 1, status: 1 })
AssetSchema.index({ companyId: 1, branchId: 1 })
AssetSchema.index({ companyId: 1, assignedTo: 1 })
AssetSchema.index({ companyId: 1, warrantyExpiry: 1 })
AssetSchema.index({ companyId: 1, amcExpiry: 1 })
AssetSchema.index({ "agent.deviceApiKeyHash": 1 })
AssetSchema.index({ companyId: 1, serialNumber: 1 })

AssetSchema.plugin(tenantScoped)

export const Asset =
  mongoose.models.Asset || mongoose.model("Asset", AssetSchema)
