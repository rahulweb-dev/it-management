"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { PHOTO_ANGLES, type ProductType } from "@/lib/constants/product-types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  InspectionForm,
  emptyInspection,
  releaseInspection,
  missingRequiredPhotos,
  buildInspectionFormData,
  type InspectionState,
} from "@/components/assets/inspection-form"

type Employee = { _id: string; name: string; email: string }

export function AssignAssetDialog({
  open,
  onOpenChange,
  assetId,
  companyId,
  productType,
  onAssigned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string | null
  companyId?: string | null
  productType: ProductType
  onAssigned: () => void
}) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [step, setStep] = useState(1)
  const [userId, setUserId] = useState("")
  const [notes, setNotes] = useState("")
  const [inspection, setInspection] = useState<InspectionState>(() => emptyInspection(productType))
  const [submitting, setSubmitting] = useState(false)
  const inspectionRef = useRef(inspection)
  inspectionRef.current = inspection

  useEffect(() => {
    if (!open) return
    setStep(1)
    setUserId("")
    setNotes("")
    setInspection(emptyInspection(productType))
    const params = companyId ? `?companyId=${companyId}` : ""
    fetch(`/api/employees${params}`)
      .then((res) => res.json())
      .then((data) => setEmployees((data.items ?? []).filter((e: { isActive?: boolean }) => e.isActive !== false)))
    return () => releaseInspection(inspectionRef.current)
  }, [open, companyId, productType])

  const missing = missingRequiredPhotos(productType, inspection)

  async function submit() {
    if (!assetId) return
    if (missing.length > 0) {
      toast.error(`Take the required photos: ${missing.map((a) => PHOTO_ANGLES[a]).join(", ")}`)
      return
    }
    setSubmitting(true)
    const res = await fetch(`/api/assets/${assetId}/assign`, {
      method: "POST",
      body: buildInspectionFormData(inspection, { userId, notes }),
    })
    setSubmitting(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Failed to assign asset")
      return
    }

    toast.success("Asset handed over — the employee will be asked to confirm its condition")
    onOpenChange(false)
    onAssigned()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign asset</DialogTitle>
          <DialogDescription>
            Step {step} of 2 — {step === 1 ? "Who is receiving it" : "Hand-over inspection"}
          </DialogDescription>
        </DialogHeader>
        <Progress value={step === 1 ? 50 : 100} className="h-1" />

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e._id} value={e._id}>
                      {e.name} — {e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hand-over notes (optional)</Label>
              <Textarea
                value={notes}
                maxLength={300}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Accessories included, bag, etc."
              />
            </div>
            <DialogFooter>
              <Button type="button" disabled={!userId} onClick={() => setStep(2)}>
                Next — inspect condition
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <InspectionForm productType={productType} value={inspection} onChange={setInspection} />
            <DialogFooter className="items-center justify-between sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <div className="flex items-center gap-3">
                {missing.length > 0 && (
                  <span className="text-xs text-muted-foreground">{missing.length} required photo(s) left</span>
                )}
                <Button type="button" onClick={submit} disabled={submitting || missing.length > 0}>
                  {submitting ? "Uploading…" : "Assign"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
