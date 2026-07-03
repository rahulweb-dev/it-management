import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"

const AssetAssignmentHistorySchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    assetId: { type: Schema.Types.ObjectId, required: true, ref: "Asset", index: true },
    fromUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    toUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    assignedDate: { type: Date, required: true, default: Date.now },
    returnedDate: { type: Date, default: null },
    signatureUrl: { type: String, default: null },
    condition: { type: String, default: null },
    notes: { type: String, default: null },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

AssetAssignmentHistorySchema.plugin(tenantScoped)

export const AssetAssignmentHistory =
  mongoose.models.AssetAssignmentHistory ||
  mongoose.model("AssetAssignmentHistory", AssetAssignmentHistorySchema)
