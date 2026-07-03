import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"

const EmailLogSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    to: { type: String, required: true },
    template: { type: String, required: true },
    subject: { type: String, required: true },
    status: { type: String, enum: ["sent", "failed"], required: true },
    error: { type: String, default: null },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

EmailLogSchema.plugin(tenantScoped)

export const EmailLog =
  mongoose.models.EmailLog || mongoose.model("EmailLog", EmailLogSchema)
