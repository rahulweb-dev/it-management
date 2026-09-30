/**
 * Product-type catalogue — what kind of thing an asset is, and everything
 * that follows from that: which photos IT must take at hand-over/return,
 * which parts get checked for damage, which spec fields the asset form
 * asks for, and the default useful life used for depreciation.
 *
 * Mongoose-free and safe to import from client components (same rule as
 * lib/constants/enums.ts).
 */

export const PHOTO_ANGLES = {
  front: "Front",
  back: "Back",
  left: "Left side",
  right: "Right side",
  top: "Top",
  bottom: "Bottom / underside",
  screen_on: "Screen (powered on)",
  keyboard: "Keyboard & touchpad",
  ports: "Ports",
  serial_label: "Serial number label",
  charger: "Charger / adapter",
  accessories: "Accessories",
} as const
export type PhotoAngle = keyof typeof PHOTO_ANGLES

export const CHECK_ITEMS = {
  body: "Body / casing",
  screen: "Screen / display",
  hinges: "Hinges",
  keyboard: "Keyboard",
  touchpad: "Touchpad",
  ports: "Ports & connectors",
  battery: "Battery health",
  charger: "Charger / power cable",
  camera: "Camera",
  speakers: "Speakers / mic",
  buttons: "Buttons",
  stand: "Stand / mount",
  cables: "Cables",
  antennas: "Antennas",
  paper_tray: "Paper tray / feeder",
  sim_tray: "SIM tray",
  asset_tag: "Asset tag / QR sticker",
  power_on: "Powers on & boots",
} as const
export type CheckItem = keyof typeof CHECK_ITEMS

// ok       — no issue
// minor    — cosmetic (scratches, scuffs) — works fine
// major    — functional damage (cracked screen, dead keys, broken hinge)
// missing  — part not handed over / not returned
export const CHECK_RESULTS = ["ok", "minor", "major", "missing"] as const
export type CheckResult = (typeof CHECK_RESULTS)[number]

const CHECK_SEVERITY: Record<CheckResult, number> = { ok: 0, minor: 1, major: 2, missing: 2 }
export function checkSeverity(result: CheckResult) {
  return CHECK_SEVERITY[result]
}

export type SpecField = {
  key: string
  label: string
  type: "text" | "number"
  unit?: string
  placeholder?: string
}

export type ProductTypeDef = {
  label: string
  /** Photos IT must take at check-out and check-in. */
  requiredPhotos: PhotoAngle[]
  /** Extra angles offered but not required. */
  optionalPhotos: PhotoAngle[]
  checklist: CheckItem[]
  specs: SpecField[]
  /** Default useful life for straight-line depreciation. */
  usefulLifeYears: number
}

const OS: SpecField = { key: "os", label: "Operating system", type: "text", placeholder: "Windows 11 Pro" }
const CPU: SpecField = { key: "processor", label: "Processor", type: "text", placeholder: "Intel i5-1235U" }
const RAM: SpecField = { key: "ramGb", label: "RAM", type: "number", unit: "GB" }
const STORAGE: SpecField = { key: "storageGb", label: "Storage", type: "number", unit: "GB" }
const SCREEN: SpecField = { key: "screenSize", label: "Screen size", type: "number", unit: "in" }

export const PRODUCT_TYPES = {
  laptop: {
    label: "Laptop",
    requiredPhotos: ["front", "back", "screen_on", "keyboard", "serial_label"],
    optionalPhotos: ["left", "right", "ports", "charger", "accessories"],
    checklist: ["body", "screen", "hinges", "keyboard", "touchpad", "ports", "battery", "charger", "camera", "asset_tag", "power_on"],
    specs: [CPU, RAM, STORAGE, SCREEN, OS, { key: "chargerSerial", label: "Charger serial", type: "text" }],
    usefulLifeYears: 3,
  },
  desktop: {
    label: "Desktop",
    requiredPhotos: ["front", "back", "serial_label"],
    optionalPhotos: ["left", "right", "ports", "accessories"],
    checklist: ["body", "ports", "cables", "buttons", "asset_tag", "power_on"],
    specs: [CPU, RAM, STORAGE, OS, { key: "gpu", label: "Graphics card", type: "text" }],
    usefulLifeYears: 4,
  },
  monitor: {
    label: "Monitor",
    requiredPhotos: ["front", "back", "screen_on", "serial_label"],
    optionalPhotos: ["ports", "accessories"],
    checklist: ["body", "screen", "stand", "ports", "cables", "buttons", "asset_tag", "power_on"],
    specs: [SCREEN, { key: "resolution", label: "Resolution", type: "text", placeholder: "1920x1080" }, { key: "panel", label: "Panel type", type: "text", placeholder: "IPS" }],
    usefulLifeYears: 5,
  },
  mobile: {
    label: "Mobile phone",
    requiredPhotos: ["front", "back", "screen_on"],
    optionalPhotos: ["left", "right", "charger", "accessories"],
    checklist: ["body", "screen", "buttons", "camera", "speakers", "battery", "charger", "sim_tray", "power_on"],
    specs: [{ key: "imei", label: "IMEI", type: "text" }, STORAGE, OS, { key: "phoneNumber", label: "Phone number", type: "text" }],
    usefulLifeYears: 2,
  },
  tablet: {
    label: "Tablet",
    requiredPhotos: ["front", "back", "screen_on"],
    optionalPhotos: ["left", "right", "charger", "accessories"],
    checklist: ["body", "screen", "buttons", "camera", "speakers", "battery", "charger", "power_on"],
    specs: [STORAGE, SCREEN, OS, { key: "imei", label: "IMEI (if cellular)", type: "text" }],
    usefulLifeYears: 3,
  },
  printer: {
    label: "Printer / scanner",
    requiredPhotos: ["front", "back", "serial_label"],
    optionalPhotos: ["top", "ports", "accessories"],
    checklist: ["body", "paper_tray", "ports", "cables", "buttons", "asset_tag", "power_on"],
    specs: [{ key: "printType", label: "Print type", type: "text", placeholder: "Laser / Inkjet" }, { key: "ipAddress", label: "IP address", type: "text" }],
    usefulLifeYears: 5,
  },
  networking: {
    label: "Networking",
    requiredPhotos: ["front", "back", "serial_label"],
    optionalPhotos: ["top", "ports"],
    checklist: ["body", "ports", "antennas", "cables", "asset_tag", "power_on"],
    specs: [{ key: "deviceKind", label: "Device", type: "text", placeholder: "Router / Switch / AP" }, { key: "portCount", label: "Ports", type: "number" }, { key: "ipAddress", label: "Management IP", type: "text" }],
    usefulLifeYears: 5,
  },
  server: {
    label: "Server",
    requiredPhotos: ["front", "back", "serial_label"],
    optionalPhotos: ["top", "ports"],
    checklist: ["body", "ports", "cables", "asset_tag", "power_on"],
    specs: [CPU, RAM, STORAGE, OS, { key: "rackUnits", label: "Rack units", type: "number", unit: "U" }],
    usefulLifeYears: 5,
  },
  accessory: {
    label: "Accessory",
    requiredPhotos: ["front"],
    optionalPhotos: ["back", "accessories"],
    checklist: ["body", "cables", "buttons"],
    specs: [{ key: "accessoryKind", label: "Kind", type: "text", placeholder: "Headset / Mouse / Dock" }],
    usefulLifeYears: 2,
  },
  other: {
    label: "Other",
    requiredPhotos: ["front", "back"],
    optionalPhotos: ["serial_label", "accessories"],
    checklist: ["body", "asset_tag"],
    specs: [],
    usefulLifeYears: 3,
  },
} satisfies Record<string, ProductTypeDef>

export type ProductType = keyof typeof PRODUCT_TYPES
export const PRODUCT_TYPE_KEYS = Object.keys(PRODUCT_TYPES) as [ProductType, ...ProductType[]]

export function productTypeDef(type: ProductType): ProductTypeDef {
  return PRODUCT_TYPES[type]
}

/**
 * Assets created before product types existed only have a free-text
 * `category` — map it to the closest type so they still get the right
 * photo/checklist requirements.
 */
export function inferProductType(category: string | null | undefined): ProductType {
  const c = (category ?? "").toLowerCase()
  if (/laptop|notebook|macbook/.test(c)) return "laptop"
  if (/desktop|workstation|\bpc\b|cpu/.test(c)) return "desktop"
  if (/monitor|display|screen/.test(c)) return "monitor"
  if (/mobile|phone|iphone|android/.test(c)) return "mobile"
  if (/tablet|ipad/.test(c)) return "tablet"
  if (/print|scan/.test(c)) return "printer"
  if (/network|router|switch|firewall|access point|wifi/.test(c)) return "networking"
  if (/server|nas/.test(c)) return "server"
  if (/accessor|mouse|keyboard|headset|dock|webcam/.test(c)) return "accessory"
  return "other"
}

/** Keeps only the spec keys this type defines, trimmed, dropping blanks. */
export function sanitizeSpecs(type: ProductType, specs: Record<string, string> | undefined) {
  const out: Record<string, string> = {}
  for (const field of PRODUCT_TYPES[type].specs as SpecField[]) {
    const value = specs?.[field.key]?.trim()
    if (value) out[field.key] = value
  }
  return out
}

export function resolveProductType(asset: { productType?: string | null; category?: string | null }): ProductType {
  return asset.productType && asset.productType in PRODUCT_TYPES
    ? (asset.productType as ProductType)
    : inferProductType(asset.category)
}
