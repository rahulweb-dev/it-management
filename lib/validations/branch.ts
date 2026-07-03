import { z } from "zod"

export const branchSchema = z.object({
  name: z.string().min(2, "Branch name is too short").max(100),
  address: z.string().max(300).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  country: z.string().max(100).optional().or(z.literal("")),
  managerId: z.string().optional().or(z.literal("")),
})

export type BranchInput = z.infer<typeof branchSchema>
