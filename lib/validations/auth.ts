import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
