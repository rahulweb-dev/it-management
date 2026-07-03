import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"

const InventoryStockSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    category: { type: String, required: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    totalQty: { type: Number, default: 0 },
    availableQty: { type: Number, default: 0 },
    assignedQty: { type: Number, default: 0 },
    repairQty: { type: Number, default: 0 },
    disposedQty: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
    lastRestockDate: { type: Date, default: null },
  },
  { timestamps: true }
)

InventoryStockSchema.index(
  { companyId: 1, branchId: 1, itemName: 1 },
  { unique: true }
)

InventoryStockSchema.plugin(tenantScoped)

export const InventoryStock =
  mongoose.models.InventoryStock ||
  mongoose.model("InventoryStock", InventoryStockSchema)
