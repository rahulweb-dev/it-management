"use client"

import { Camera, RefreshCw, X } from "lucide-react"
import { ASSET_CONDITIONS } from "@/lib/constants/enums"
import {
  PHOTO_ANGLES,
  CHECK_ITEMS,
  CHECK_RESULTS,
  productTypeDef,
  checkSeverity,
  type PhotoAngle,
  type CheckItem,
  type CheckResult,
  type ProductType,
} from "@/lib/constants/product-types"
import { compressImage } from "@/lib/image-compress"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AssetCondition = (typeof ASSET_CONDITIONS)[number]

export type InspectionRecord = {
  _id: string
  kind: "check_out" | "check_in"
  photos: { angle: string; url: string }[]
  checklist: { item: string; result: CheckResult; note: string | null }[]
  overallCondition: string
  hasDamage: boolean
  newDamage: string[]
  repairCostEstimate: number | null
  chargeToEmployee: boolean
  notes: string | null
  acknowledgedAt: string | null
  createdAt: string
  performedBy: { name: string } | null
}

export type InspectionState = {
  photos: Partial<Record<PhotoAngle, { blob: Blob; preview: string }>>
  checklist: Partial<Record<CheckItem, { result: CheckResult; note: string }>>
  /** null = follow the checklist-derived suggestion */
  overallCondition: AssetCondition | null
  notes: string
}

export function emptyInspection(type: ProductType): InspectionState {
  const checklist: InspectionState["checklist"] = {}
  for (const item of productTypeDef(type).checklist) checklist[item] = { result: "ok", note: "" }
  return { photos: {}, checklist, overallCondition: null, notes: "" }
}

/** Frees the object URLs backing photo previews — call when a dialog closes. */
export function releaseInspection(state: InspectionState) {
  for (const p of Object.values(state.photos)) if (p) URL.revokeObjectURL(p.preview)
}

export function suggestedCondition(state: InspectionState): AssetCondition {
  const results = Object.values(state.checklist).map((c) => c!.result)
  if (results.includes("major")) return "needs_repair"
  if (results.includes("missing")) return "damaged"
  return "good"
}

export function effectiveCondition(state: InspectionState) {
  return state.overallCondition ?? suggestedCondition(state)
}

export function missingRequiredPhotos(type: ProductType, state: InspectionState) {
  return productTypeDef(type).requiredPhotos.filter((a) => !state.photos[a])
}

/** Items worse now than in the baseline — mirrors diffNewDamage() in lib/inspection.ts. */
export function previewNewDamage(state: InspectionState, baseline: InspectionRecord | null) {
  const before = new Map((baseline?.checklist ?? []).map((c) => [c.item, c.result]))
  return (Object.entries(state.checklist) as [CheckItem, { result: CheckResult }][])
    .filter(([item, c]) => checkSeverity(c.result) > checkSeverity(before.get(item) ?? "ok"))
    .map(([item]) => item)
}

/** Builds the multipart body the assign/unassign routes expect. */
export function buildInspectionFormData(state: InspectionState, payload: Record<string, unknown>) {
  const fd = new FormData()
  fd.set(
    "payload",
    JSON.stringify({
      ...payload,
      inspection: {
        ...((payload.inspection as object) ?? {}),
        checklist: Object.entries(state.checklist).map(([item, c]) => ({
          item,
          result: c!.result,
          note: c!.result === "ok" ? "" : c!.note,
        })),
        overallCondition: effectiveCondition(state),
        notes: state.notes,
      },
    })
  )
  for (const [angle, p] of Object.entries(state.photos)) {
    if (p) fd.append(`photo:${angle}`, p.blob, `${angle}.jpg`)
  }
  return fd
}

const RESULT_STYLES: Record<CheckResult, string> = {
  ok: "border-status-success/40 bg-status-success/15 text-status-success",
  minor: "border-status-warning/40 bg-status-warning/15 text-status-warning",
  major: "border-status-danger/40 bg-status-danger/15 text-status-danger",
  missing: "border-status-danger/40 bg-status-danger/15 text-status-danger",
}

export function resultClasses(result: CheckResult) {
  return RESULT_STYLES[result]
}

function PhotoTile({
  angle,
  required,
  photo,
  baselineUrl,
  onPick,
  onRemove,
}: {
  angle: PhotoAngle
  required: boolean
  photo?: { preview: string }
  baselineUrl?: string
  onPick: (file: File) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-1">
      <label
        className={cn(
          "group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted/40 transition-colors hover:border-primary",
          photo && "border-solid border-transparent",
          required && !photo && "border-primary/40"
        )}
      >
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt={PHOTO_ANGLES[angle]} className="h-full w-full object-cover" />
            <span className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/50 text-xs font-medium text-white group-hover:flex">
              <RefreshCw className="h-3.5 w-3.5" /> Retake
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <Camera className="h-5 w-5" />
            Take photo
          </span>
        )}
        {baselineUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={baselineUrl}
            alt={`${PHOTO_ANGLES[angle]} at hand-over`}
            title="At hand-over"
            className="absolute bottom-1 left-1 h-8 w-10 rounded border-2 border-background object-cover shadow"
          />
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPick(file)
            e.target.value = ""
          }}
        />
      </label>
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-xs">
          {PHOTO_ANGLES[angle]}
          {required && <span className="text-status-danger"> *</span>}
        </p>
        {photo && (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-status-danger"
            aria-label={`Remove ${PHOTO_ANGLES[angle]} photo`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export function InspectionForm({
  productType,
  value,
  onChange,
  baseline,
}: {
  productType: ProductType
  value: InspectionState
  onChange: (next: InspectionState) => void
  /** The hand-over inspection, shown for comparison when checking an asset back in. */
  baseline?: InspectionRecord | null
}) {
  const def = productTypeDef(productType)
  const baselinePhotos = new Map((baseline?.photos ?? []).map((p) => [p.angle, p.url]))
  const baselineChecks = new Map((baseline?.checklist ?? []).map((c) => [c.item, c]))

  async function pick(angle: PhotoAngle, file: File) {
    const blob = await compressImage(file)
    const old = value.photos[angle]
    if (old) URL.revokeObjectURL(old.preview)
    onChange({ ...value, photos: { ...value.photos, [angle]: { blob, preview: URL.createObjectURL(blob) } } })
  }

  function remove(angle: PhotoAngle) {
    const old = value.photos[angle]
    if (old) URL.revokeObjectURL(old.preview)
    const photos = { ...value.photos }
    delete photos[angle]
    onChange({ ...value, photos })
  }

  function setCheck(item: CheckItem, patch: Partial<{ result: CheckResult; note: string }>) {
    const current = value.checklist[item] ?? { result: "ok" as CheckResult, note: "" }
    onChange({ ...value, checklist: { ...value.checklist, [item]: { ...current, ...patch } } })
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-medium">Condition photos</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          On a phone this opens the camera. <span className="text-status-danger">*</span> required for a {def.label.toLowerCase()}.
          {baseline && " The small inset shows the same angle at hand-over."}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...def.requiredPhotos, ...def.optionalPhotos].map((angle) => (
            <PhotoTile
              key={angle}
              angle={angle}
              required={def.requiredPhotos.includes(angle)}
              photo={value.photos[angle]}
              baselineUrl={baselinePhotos.get(angle)}
              onPick={(file) => pick(angle, file)}
              onRemove={() => remove(angle)}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium">Damage checklist</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Minor = cosmetic (scratches, scuffs). Major = doesn&apos;t work properly or is broken.
        </p>
        <div className="divide-y rounded-lg border">
          {def.checklist.map((item) => {
            const check = value.checklist[item] ?? { result: "ok" as CheckResult, note: "" }
            const before = baselineChecks.get(item)
            const worse = before && checkSeverity(check.result) > checkSeverity(before.result)
            return (
              <div key={item} className={cn("space-y-2 p-2.5", worse && "bg-status-danger/5")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm">{CHECK_ITEMS[item]}</p>
                    {before && (
                      <p className="text-xs text-muted-foreground">
                        At hand-over: <span className="capitalize">{before.result}</span>
                        {before.note ? ` — ${before.note}` : ""}
                        {worse && <span className="font-medium text-status-danger"> · new damage</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1" role="radiogroup" aria-label={CHECK_ITEMS[item]}>
                    {CHECK_RESULTS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={check.result === r}
                        onClick={() => setCheck(item, { result: r })}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs capitalize transition-colors",
                          check.result === r ? resultClasses(r) : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {check.result !== "ok" && (
                  <Input
                    value={check.note}
                    maxLength={200}
                    onChange={(e) => setCheck(item, { note: e.target.value })}
                    placeholder="Describe it — e.g. 2cm scratch near the hinge, left side"
                    className="h-8 text-xs"
                  />
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Overall condition</Label>
          <Select
            value={effectiveCondition(value)}
            onValueChange={(v) => onChange({ ...value, overallCondition: v as AssetCondition })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_CONDITIONS.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {value.overallCondition === null && (
            <p className="text-xs text-muted-foreground">Suggested from the checklist.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Inspection notes</Label>
          <Textarea
            value={value.notes}
            maxLength={500}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            placeholder="Anything else worth recording"
            className="min-h-9"
          />
        </div>
      </section>
    </div>
  )
}
