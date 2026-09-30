"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { CHECK_ITEMS, PHOTO_ANGLES, type ProductType } from "@/lib/constants/product-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InspectionForm,
  emptyInspection,
  releaseInspection,
  missingRequiredPhotos,
  previewNewDamage,
  buildInspectionFormData,
  type InspectionRecord,
  type InspectionState,
} from "@/components/assets/inspection-form"

export function ReturnAssetDialog({
  open,
  onOpenChange,
  assetId,
  employeeName,
  productType,
  checkOut,
  onReturned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string | null
  employeeName: string
  productType: ProductType
  /** The hand-over inspection for the current assignment, if one was recorded. */
  checkOut: InspectionRecord | null
  onReturned: () => void
}) {
  const [inspection, setInspection] = useState<InspectionState>(() => emptyInspection(productType))
  const [notes, setNotes] = useState("")
  const [sendToRepair, setSendToRepair] = useState<boolean | null>(null)
  const [repairCost, setRepairCost] = useState("")
  const [chargeToEmployee, setChargeToEmployee] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const inspectionRef = useRef(inspection)
  inspectionRef.current = inspection

  useEffect(() => {
    if (!open) return
    setInspection(emptyInspection(productType))
    setNotes("")
    setSendToRepair(null)
    setRepairCost("")
    setChargeToEmployee(false)
    return () => releaseInspection(inspectionRef.current)
  }, [open, productType])

  const missing = missingRequiredPhotos(productType, inspection)
  const newDamage = previewNewDamage(inspection, checkOut)
  const hasMajor = Object.values(inspection.checklist).some((c) => c?.result === "major")
  const repair = sendToRepair ?? hasMajor

  async function submit() {
    if (!assetId) return
    if (missing.length > 0) {
      toast.error(`Take the required photos: ${missing.map((a) => PHOTO_ANGLES[a]).join(", ")}`)
      return
    }
    setSubmitting(true)
    const cost = Number(repairCost)
    const res = await fetch(`/api/assets/${assetId}/unassign`, {
      method: "POST",
      body: buildInspectionFormData(inspection, {
        notes,
        sendToRepair: repair,
        inspection: {
          ...(newDamage.length > 0 && repairCost && Number.isFinite(cost) && { repairCostEstimate: cost }),
          chargeToEmployee: newDamage.length > 0 && chargeToEmployee,
        },
      }),
    })
    setSubmitting(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Failed to return asset")
      return
    }
    const data = await res.json()
    const damaged = data.inspection?.newDamage?.length ?? 0
    toast.success(damaged > 0 ? `Returned — ${damaged} new damage item(s) recorded` : "Asset returned")
    onOpenChange(false)
    onReturned()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Return from {employeeName}</DialogTitle>
          <DialogDescription>
            {checkOut
              ? "Photograph the same angles and check every part. Anything worse than at hand-over is flagged as new damage."
              : "No hand-over inspection was recorded for this assignment, so any issue found now is treated as new damage."}
          </DialogDescription>
        </DialogHeader>

        <InspectionForm productType={productType} value={inspection} onChange={setInspection} baseline={checkOut} />

        {newDamage.length > 0 && (
          <div className="space-y-3 rounded-lg border border-status-danger/30 bg-status-danger/5 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-status-danger">
              <AlertTriangle className="h-4 w-4" />
              New damage: {newDamage.map((i) => CHECK_ITEMS[i]).join(", ")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Repair cost estimate (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={repairCost}
                  onChange={(e) => setRepairCost(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <label className="flex items-center justify-between gap-3 rounded-md border bg-background p-2.5 text-sm">
                Recover cost from employee
                <Switch checked={chargeToEmployee} onCheckedChange={setChargeToEmployee} />
              </label>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
            <span>
              Send to repair
              <span className="block text-xs text-muted-foreground">
                {repair ? "Status → in repair" : "Status → available"}
              </span>
            </span>
            <Switch checked={repair} onCheckedChange={setSendToRepair} />
          </label>
          <Textarea
            value={notes}
            maxLength={300}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Return notes (optional)"
            className="min-h-9"
          />
        </div>

        <DialogFooter className="items-center">
          {missing.length > 0 && (
            <span className="text-xs text-muted-foreground">{missing.length} required photo(s) left</span>
          )}
          <Button type="button" onClick={submit} disabled={submitting || missing.length > 0}>
            {submitting ? "Uploading…" : "Confirm return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
