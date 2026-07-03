import { z } from "zod"
import { COMPANY_ROLES } from "@/lib/constants/enums"

export const employeeCreateSchema = z.object({
  name: z.string().min(2, "Name is too short").max(100),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().max(30).optional().or(z.literal("")),
  role: z.enum(COMPANY_ROLES),
  branchId: z.string().min(1, "Branch is required"),
  department: z.string().max(100).optional().or(z.literal("")),
  managerId: z.string().optional().or(z.literal("")),
  joiningDate: z.string().optional().or(z.literal("")),
})

export const employeeUpdateSchema = employeeCreateSchema
  .omit({ password: true })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  })

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>

export const employeeInviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
})

export type EmployeeInviteInput = z.infer<typeof employeeInviteSchema>

// Self-onboarding: the employee fills this in themselves, so role is
// deliberately not a field here — self-registered accounts are always
// "employee"; only IT can promote someone to it_person. employeeCode is
// required and typed in by the employee (their existing HR/payroll ID),
// not auto-generated, unlike the manual "Add employee" flow. email is
// only actually used server-side when the invite link is the generic,
// company-wide kind (no email pre-attached to the token).
export const employeeOnboardSchema = z.object({
  token: z.string().min(1),
  employeeCode: z.string().min(1, "Employee ID is required").max(50),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  name: z.string().min(2, "Name is too short").max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().max(30).optional().or(z.literal("")),
  branchId: z.string().min(1, "Select your branch"),
  department: z.string().max(100).optional().or(z.literal("")),
})

export type EmployeeOnboardInput = z.infer<typeof employeeOnboardSchema>
