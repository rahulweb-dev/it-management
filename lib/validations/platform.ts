import { z } from "zod"
import { PLANS } from "@/lib/constants/enums"

export const createCompanySchema = z.object({
  companyName: z.string().min(2, "Company name is too short").max(100),
  itPersonName: z.string().min(2, "Name is too short").max(100),
  itPersonEmail: z.string().email("Enter a valid email"),
  itPersonPassword: z.string().min(8, "Password must be at least 8 characters"),
  plan: z.enum(PLANS),
  // Groups companies so one IT Person can manage several — see
  // lib/organization.ts. Joining an existing group must be an explicit
  // pick by id (organizationId); organizationName only ever *creates* a
  // new group, and is refused if that name is taken. Matching by typed
  // name used to silently merge unrelated customers sharing a name.
  // Both blank means this company stands alone.
  organizationId: z.string().optional().or(z.literal("")),
  organizationName: z.string().max(120).optional().or(z.literal("")),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>

export const updateCompanySchema = z.object({
  subscriptionStatus: z.enum(["active", "canceled"]).optional(),
  plan: z.enum(PLANS).optional(),
  maxAssets: z.number().int().min(1).max(1_000_000).optional(),
  maxEmployees: z.number().int().min(1).max(1_000_000).optional(),
})

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
