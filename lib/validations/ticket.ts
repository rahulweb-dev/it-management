import { z } from "zod"
import { ISSUE_TYPES, PRIORITIES, TICKET_STATUSES } from "@/lib/constants/enums"

export const ticketCreateSchema = z.object({
  issueType: z.enum(ISSUE_TYPES),
  priority: z.enum(PRIORITIES),
  description: z.string().min(10, "Describe the issue in a bit more detail").max(2000),
  relatedAssetId: z.string().optional().or(z.literal("")),
})

export const ticketStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
})

export const ticketAssignSchema = z.object({
  assignedTo: z.string().min(1, "Select someone to assign this to"),
})

export const commentSchema = z.object({
  message: z.string().min(1, "Comment can't be empty").max(1000),
})

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>
export type TicketStatusInput = z.infer<typeof ticketStatusSchema>
export type TicketAssignInput = z.infer<typeof ticketAssignSchema>
export type CommentInput = z.infer<typeof commentSchema>
