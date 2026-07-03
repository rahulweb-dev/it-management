import { z } from "zod"
import { BILLING_CYCLES } from "@/lib/constants/enums"

export const licenseCreateSchema = z.object({
  name: z.string().min(2, "Name is too short").max(100),
  vendor: z.string().min(1, "Vendor is required").max(100),
  licenseKey: z.string().max(200).optional().or(z.literal("")),
  // Kept as strings (not z.coerce.number()) — coercion makes zod's input
  // and output types diverge, which breaks react-hook-form's resolver
  // typing. Parsed to Number() server-side instead, same as purchaseCost
  // in lib/validations/asset.ts.
  seats: z.string().optional().or(z.literal("")),
  cost: z.string().optional().or(z.literal("")),
  billingCycle: z.enum(BILLING_CYCLES),
  startDate: z.string().min(1, "Start date is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  reminderDaysBefore: z.string().optional().or(z.literal("")),
  assignedTo: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
})

export const licenseUpdateSchema = licenseCreateSchema.partial().extend({
  cancelled: z.boolean().optional(),
})

export type LicenseCreateInput = z.infer<typeof licenseCreateSchema>
export type LicenseUpdateInput = z.infer<typeof licenseUpdateSchema>
