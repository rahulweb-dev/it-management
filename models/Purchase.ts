import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"

const PurchaseItemSchema = new Schema(
  {
    itemName: { type: String, required: true },
    category: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const PurchaseSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    poNumber: { type: String, required: true },
    vendor: { type: String, required: true },
    invoiceNumber: { type: String, default: null },
    invoiceUrl: { type: String, default: null },
    items: { type: [PurchaseItemSchema], default: [] },
    totalCost: { type: Number, default: 0 },
    purchaseDate: { type: Date, required: true, default: Date.now },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
)

PurchaseSchema.index({ companyId: 1, poNumber: 1 }, { unique: true })

;(PurchaseSchema as any).pre("validate", async function (this: any) {
  this.totalCost = (this.items ?? []).reduce(
    (sum: number, item: any) => sum + item.qty * item.unitCost,
    0
  )
})

PurchaseSchema.plugin(tenantScoped)

export const Purchase =
  mongoose.models.Purchase || mongoose.model("Purchase", PurchaseSchema)
