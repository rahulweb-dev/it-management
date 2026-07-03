import { z } from "zod"
import { PLANS } from "@/lib/constants/enums"

export const createCompanySchema = z.object({
  companyName: z.string().min(2, "Company name is too short").max(100),
  itPersonName: z.string().min(2, "Name is too short").max(100),
  itPersonEmail: z.string().email("Enter a valid email"),
  itPersonPassword: z.string().min(8, "Password must be at least 8 characters"),
  plan: z.enum(PLANS),
  // Groups this company with others under the same name so one IT Person
  // can manage several companies — see lib/organization.ts. Blank means
  // this company stands alone.
  organizationName: z.string().max(120).optional().or(z.literal("")),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>

export const updateCompanySchema = z.object({
  subscriptionStatus: z.enum(["active", "canceled"]).optional(),
  plan: z.enum(PLANS).optional(),
})

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
