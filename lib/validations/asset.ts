import { z } from "zod"
import { ASSET_CONDITIONS } from "@/lib/constants/enums"

export const assetCreateSchema = z.object({
  assetName: z.string().min(2, "Asset name is too short").max(100),
  category: z.string().min(2, "Category is required").max(60),
  brand: z.string().max(60).optional().or(z.literal("")),
  model: z.string().max(60).optional().or(z.literal("")),
  serialNumber: z.string().max(100).optional().or(z.literal("")),
  branchId: z.string().min(1, "Branch is required"),
  location: z.string().max(120).optional().or(z.literal("")),
  condition: z.enum(ASSET_CONDITIONS),
  purchaseDate: z.string().optional().or(z.literal("")),
  purchaseCost: z.string().optional().or(z.literal("")),
  vendor: z.string().max(100).optional().or(z.literal("")),
  warrantyExpiry: z.string().optional().or(z.literal("")),
  amcExpiry: z.string().optional().or(z.literal("")),
  // Which sibling company (within the caller's organization) this asset
  // belongs to. Empty/omitted means "my own company" — see lib/organization.ts.
  targetCompanyId: z.string().optional().or(z.literal("")),
})

export const assetUpdateSchema = assetCreateSchema.partial()

export const assignAssetSchema = z.object({
  userId: z.string().min(1, "Select an employee"),
  notes: z.string().max(300).optional().or(z.literal("")),
})

export const unassignAssetSchema = z.object({
  condition: z.enum(ASSET_CONDITIONS).optional(),
  notes: z.string().max(300).optional().or(z.literal("")),
})

export type AssetCreateInput = z.infer<typeof assetCreateSchema>
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>
export type AssignAssetInput = z.infer<typeof assignAssetSchema>
export type UnassignAssetInput = z.infer<typeof unassignAssetSchema>
