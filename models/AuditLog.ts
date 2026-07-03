import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"

const AuditLogSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    changes: { type: Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

AuditLogSchema.index({ companyId: 1, entityType: 1, entityId: 1 })
AuditLogSchema.index({ companyId: 1, timestamp: -1 })

AuditLogSchema.plugin(tenantScoped)

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema)
