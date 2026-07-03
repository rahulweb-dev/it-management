import { z } from "zod"

export const hardwarePayloadSchema = z.object({
  hostname: z.string().max(200).optional(),
  deviceType: z.enum(["laptop", "desktop"]).optional(),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  cpu: z.string().max(200).optional(),
  ramGb: z.coerce.number().min(0).max(4096).optional(),
  storageGb: z.coerce.number().min(0).max(1_000_000).optional(),
  os: z.string().max(200).optional(),
  serialNumber: z.string().max(200).optional(),
  ipAddress: z.string().max(64).optional(),
  macAddress: z.string().max(64).optional(),
  loggedInUser: z.string().max(200).optional(),
})

export const enrollSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["windows", "mac"]),
  hardware: hardwarePayloadSchema,
})

export const checkinSchema = z.object({
  hardware: hardwarePayloadSchema,
})

export type HardwarePayload = z.infer<typeof hardwarePayloadSchema>
export type EnrollInput = z.infer<typeof enrollSchema>
export type CheckinInput = z.infer<typeof checkinSchema>
