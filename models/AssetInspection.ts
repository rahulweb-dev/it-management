import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"
import { ASSET_CONDITIONS } from "@/lib/constants/enums"
import { CHECK_RESULTS } from "@/lib/constants/product-types"

// One condition check of a physical asset: the photos IT took (front,
// back, screen...) and a per-part damage checklist. Recorded at every
// hand-over ("check_out") and return ("check_in") so any damage can be
// traced to the assignment it happened during.
const InspectionPhotoSchema = new Schema(
  {
    angle: { type: String, required: true },
    url: { type: String, required: true },
    sizeBytes: { type: Number, default: 0 },
  },
  { _id: false }
)

const InspectionCheckSchema = new Schema(
  {
    item: { type: String, required: true },
    result: { type: String, enum: CHECK_RESULTS, required: true },
    note: { type: String, default: null },
  },
  { _id: false }
)

const AssetInspectionSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    assetId: { type: Schema.Types.ObjectId, required: true, ref: "Asset" },
    assignmentId: { type: Schema.Types.ObjectId, ref: "AssetAssignmentHistory", default: null },
    kind: { type: String, enum: ["check_out", "check_in"], required: true },
    productType: { type: String, required: true },
    // The employee receiving (check_out) or returning (check_in) the asset.
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    photos: { type: [InspectionPhotoSchema], default: [] },
    checklist: { type: [InspectionCheckSchema], default: [] },
    overallCondition: { type: String, enum: ASSET_CONDITIONS, required: true },
    hasDamage: { type: Boolean, default: false },
    // check_in only: checklist items that got worse since the matching
    // check_out — i.e. damage that happened during this assignment.
    newDamage: { type: [String], default: [] },
    repairCostEstimate: { type: Number, default: null, min: 0 },
    chargeToEmployee: { type: Boolean, default: false },
    notes: { type: String, default: null },
    // check_out only: the employee confirming they received the asset in
    // the recorded condition — protects both sides in a later dispute.
    acknowledgedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

AssetInspectionSchema.index({ companyId: 1, assetId: 1, createdAt: -1 })
AssetInspectionSchema.index({ companyId: 1, employeeId: 1, acknowledgedAt: 1 })

AssetInspectionSchema.plugin(tenantScoped)

export const AssetInspection =
  mongoose.models.AssetInspection || mongoose.model("AssetInspection", AssetInspectionSchema)
