import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"
import { MOVEMENT_STATUSES } from "@/lib/constants/enums"

const AssetMovementSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    assetId: { type: Schema.Types.ObjectId, required: true, ref: "Asset", index: true },
    fromBranchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    toBranchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    movedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    movedDate: { type: Date, required: true, default: Date.now },
    reason: { type: String, default: null },
    transportDetails: { type: String, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: MOVEMENT_STATUSES, default: "pending" },
  },
  { timestamps: true }
)

AssetMovementSchema.plugin(tenantScoped)

export const AssetMovement =
  mongoose.models.AssetMovement ||
  mongoose.model("AssetMovement", AssetMovementSchema)
