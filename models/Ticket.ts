import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"
import { ISSUE_TYPES, PRIORITIES, TICKET_STATUSES } from "@/lib/constants/enums"

const CommentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    attachment: { type: String, default: null },
  },
  { _id: true }
)

const TicketSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    ticketId: { type: String, required: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    issueType: { type: String, enum: ISSUE_TYPES, required: true },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    description: { type: String, required: true },
    attachments: { type: [String], default: [] },
    relatedAssetId: { type: Schema.Types.ObjectId, ref: "Asset", default: null },
    status: { type: String, enum: TICKET_STATUSES, default: "open" },
    slaDeadline: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    comments: { type: [CommentSchema], default: [] },
  },
  { timestamps: true }
)

TicketSchema.index({ companyId: 1, ticketId: 1 }, { unique: true })
TicketSchema.index({ companyId: 1, status: 1 })
TicketSchema.index({ companyId: 1, raisedBy: 1 })
TicketSchema.index({ companyId: 1, assignedTo: 1 })
TicketSchema.index({ companyId: 1, slaDeadline: 1 })

TicketSchema.plugin(tenantScoped)

export const Ticket =
  mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema)
