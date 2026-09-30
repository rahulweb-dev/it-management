import { PRODUCT_TYPES, resolveProductType } from "@/lib/constants/product-types"

/**
 * Book value of an asset, computed on read (never stored, so it's always
 * current and changing the rules re-values everything at once).
 *
 * - Straight-line (default): cost falls evenly to a 5% residual over the
 *   product type's useful life (lib/constants/product-types.ts).
 * - Written-down value: when an asset has `depreciationRate` > 0, that
 *   annual % is applied to the remaining value each year (the common
 *   Indian tax-book method), with the same 5% floor.
 * - Disposed / lost assets are written off: book value 0.
 *
 * Depreciation runs from purchaseDate, falling back to when the asset was
 * added. Mongoose-free — used by the dashboard, export and detail sheet.
 */

export const RESIDUAL_PCT = 0.05
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

export type DepreciableAsset = {
  purchaseCost?: number | null
  purchaseDate?: string | Date | null
  createdAt?: string | Date | null
  depreciationRate?: number | null
  productType?: string | null
  category?: string | null
  status?: string | null
}

export type Valuation = {
  cost: number
  bookValue: number
  accumulated: number
  method: "straight_line" | "written_down" | "written_off"
  ageYears: number
  usefulLifeYears: number
  fullyDepreciated: boolean
}

export function valueAsset(asset: DepreciableAsset, asOf: Date = new Date()): Valuation {
  const cost = Math.max(0, Number(asset.purchaseCost) || 0)
  const usefulLifeYears = PRODUCT_TYPES[resolveProductType(asset)].usefulLifeYears
  const start = asset.purchaseDate ?? asset.createdAt
  const ageYears = start ? Math.max(0, (asOf.getTime() - new Date(start).getTime()) / MS_PER_YEAR) : 0
  const residual = cost * RESIDUAL_PCT

  if (asset.status === "disposed" || asset.status === "lost") {
    return { cost, bookValue: 0, accumulated: cost, method: "written_off", ageYears, usefulLifeYears, fullyDepreciated: true }
  }

  let bookValue: number
  let method: Valuation["method"]
  const rate = Number(asset.depreciationRate) || 0
  if (rate > 0) {
    method = "written_down"
    bookValue = Math.max(residual, cost * Math.pow(1 - Math.min(rate, 100) / 100, ageYears))
  } else {
    method = "straight_line"
    bookValue = cost - (cost - residual) * Math.min(1, ageYears / usefulLifeYears)
  }

  bookValue = Math.round(bookValue)
  return {
    cost,
    bookValue,
    accumulated: cost - bookValue,
    method,
    ageYears,
    usefulLifeYears,
    fullyDepreciated: cost > 0 && bookValue <= Math.round(residual),
  }
}

/** Compact Indian-format rupees for tiles: ₹4.2L, ₹1.3Cr. */
export function formatInrCompact(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n)
}

/** Full rupees for tables and tooltips: ₹4,20,000. */
export function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
}
