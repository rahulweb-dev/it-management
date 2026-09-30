"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CheckCircle2, Clock, Columns2 } from "lucide-react"
import { CHECK_ITEMS, PHOTO_ANGLES, type CheckItem, type PhotoAngle } from "@/lib/constants/product-types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { resultClasses, type InspectionRecord } from "@/components/assets/inspection-form"

const angleLabel = (a: string) => PHOTO_ANGLES[a as PhotoAngle] ?? a
const itemLabel = (i: string) => CHECK_ITEMS[i as CheckItem] ?? i

function Thumb({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" title={label} className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="h-12 w-16 rounded border object-cover hover:opacity-80" />
    </a>
  )
}

function InspectionBlock({
  title,
  inspection,
  newDamage,
}: {
  title: string
  inspection: InspectionRecord
  newDamage?: string[]
}) {
  const issues = inspection.checklist.filter((c) => c.result !== "ok")
  return (
    <div className="space-y-2 rounded-md border p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">{title}</span>
        <StatusBadge status={inspection.overallCondition} className="text-[10px]" />
        <span className="text-xs text-muted-foreground">
          {format(new Date(inspection.createdAt), "MMM d, yyyy")}
          {inspection.performedBy && ` · by ${inspection.performedBy.name}`}
        </span>
      </div>
      {inspection.photos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {inspection.photos.map((p) => (
            <Thumb key={p.angle} url={p.url} label={angleLabel(p.angle)} />
          ))}
        </div>
      )}
      {issues.length === 0 ? (
        <p className="text-xs text-status-success">No damage recorded</p>
      ) : (
        <ul className="space-y-1">
          {issues.map((c) => (
            <li key={c.item} className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className={cn("rounded border px-1.5 py-0.5 capitalize", resultClasses(c.result))}>{c.result}</span>
              <span className={cn(newDamage?.includes(c.item) && "font-medium")}>{itemLabel(c.item)}</span>
              {newDamage?.includes(c.item) && <span className="text-status-danger">new</span>}
              {c.note && <span className="text-muted-foreground">— {c.note}</span>}
            </li>
          ))}
        </ul>
      )}
      {inspection.kind === "check_in" && (inspection.repairCostEstimate || inspection.chargeToEmployee) && (
        <p className="text-xs">
          {inspection.repairCostEstimate ? `Repair estimate ₹${inspection.repairCostEstimate.toLocaleString()}` : ""}
          {inspection.repairCostEstimate && inspection.chargeToEmployee ? " · " : ""}
          {inspection.chargeToEmployee && <span className="text-status-danger">recover from employee</span>}
        </p>
      )}
      {inspection.notes && <p className="text-xs text-muted-foreground">{inspection.notes}</p>}
    </div>
  )
}

export function InspectionSummary({
  checkOut,
  checkIn,
  canAcknowledge,
  onAcknowledge,
}: {
  checkOut: InspectionRecord | null
  checkIn: InspectionRecord | null
  canAcknowledge: boolean
  onAcknowledge: () => void
}) {
  const [compare, setCompare] = useState(false)
  if (!checkOut && !checkIn) return null

  const angles = [...new Set([...(checkOut?.photos ?? []), ...(checkIn?.photos ?? [])].map((p) => p.angle))]
  const outByAngle = new Map((checkOut?.photos ?? []).map((p) => [p.angle, p.url]))
  const inByAngle = new Map((checkIn?.photos ?? []).map((p) => [p.angle, p.url]))

  return (
    <div className="mt-2 space-y-2">
      {checkOut && (
        <>
          <InspectionBlock title="Hand-over" inspection={checkOut} />
          {checkOut.acknowledgedAt ? (
            <p className="flex items-center gap-1 text-xs text-status-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Employee confirmed receipt {format(new Date(checkOut.acknowledgedAt), "MMM d, yyyy")}
            </p>
          ) : canAcknowledge ? (
            <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
              <p className="text-xs">
                Please check the photos and damage notes above match the device you received.
              </p>
              <Button size="sm" onClick={onAcknowledge}>
                <CheckCircle2 className="h-4 w-4" />
                I confirm receipt in this condition
              </Button>
            </div>
          ) : (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Awaiting employee confirmation
            </p>
          )}
        </>
      )}
      {checkIn && <InspectionBlock title="Return" inspection={checkIn} newDamage={checkIn.newDamage} />}

      {checkOut && checkIn && angles.length > 0 && (
        <>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCompare((v) => !v)}>
            <Columns2 className="h-3.5 w-3.5" />
            {compare ? "Hide comparison" : "Compare photos side by side"}
          </Button>
          {compare && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-muted-foreground">
                <span>Hand-over</span>
                <span>Return</span>
              </div>
              {angles.map((angle) => (
                <div key={angle}>
                  <p className="mb-1 text-xs">{angleLabel(angle)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[outByAngle.get(angle), inByAngle.get(angle)].map((url, i) =>
                      url ? (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="aspect-[4/3] w-full rounded border object-cover" />
                        </a>
                      ) : (
                        <div
                          key={i}
                          className="flex aspect-[4/3] items-center justify-center rounded border border-dashed text-[11px] text-muted-foreground"
                        >
                          Not taken
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
