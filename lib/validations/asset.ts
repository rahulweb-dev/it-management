import { z } from "zod"
import { ASSET_CONDITIONS } from "@/lib/constants/enums"
import { CHECK_RESULTS, PRODUCT_TYPE_KEYS } from "@/lib/constants/product-types"

export const assetCreateSchema = z.object({
  assetName: z.string().min(2, "Asset name is too short").max(100),
  productType: z.enum(PRODUCT_TYPE_KEYS, { message: "Select a product type" }),
  // Free-text sub-category (e.g. "Ultrabook", "Label printer"). Defaults
  // to the product type's label server-side when left empty.
  category: z.string().max(60).optional().or(z.literal("")),
  specs: z.record(z.string().max(40), z.string().max(200)).optional(),
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

// The JSON half of a hand-over/return request. Photos travel alongside it
// as multipart files named `photo:<angle>` — see lib/inspection.ts.
export const inspectionInputSchema = z.object({
  checklist: z
    .array(
      z.object({
        item: z.string().min(1).max(40),
        result: z.enum(CHECK_RESULTS),
        note: z.string().max(200).optional().or(z.literal("")),
      })
    )
    .max(30),
  overallCondition: z.enum(ASSET_CONDITIONS),
  notes: z.string().max(500).optional().or(z.literal("")),
})

export const assignAssetSchema = z.object({
  userId: z.string().min(1, "Select an employee"),
  notes: z.string().max(300).optional().or(z.literal("")),
  inspection: inspectionInputSchema,
})

export const unassignAssetSchema = z.object({
  notes: z.string().max(300).optional().or(z.literal("")),
  inspection: inspectionInputSchema.extend({
    repairCostEstimate: z.number().min(0).max(1_000_000_000).optional(),
    chargeToEmployee: z.boolean().optional(),
  }),
  // Returned with damage — park it in repair instead of back in the pool.
  sendToRepair: z.boolean().optional(),
})

export type AssetCreateInput = z.infer<typeof assetCreateSchema>
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>
export type InspectionInput = z.infer<typeof inspectionInputSchema>
export type AssignAssetInput = z.infer<typeof assignAssetSchema>
export type UnassignAssetInput = z.infer<typeof unassignAssetSchema>
