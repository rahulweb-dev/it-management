import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"
import { NOTIFICATION_TYPES } from "@/lib/constants/enums"

const NotificationSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    link: { type: String, default: null },
  },
  { timestamps: true }
)

NotificationSchema.index({ companyId: 1, userId: 1, isRead: 1 })

NotificationSchema.plugin(tenantScoped)

export const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema)
