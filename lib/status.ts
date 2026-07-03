/**
 * Single source of truth for the status-color language used across badges,
 * charts, and timelines. Every status string in the app maps to exactly one
 * of these four tones — never pick a color ad hoc at the call site.
 */
export type StatusTone = "success" | "info" | "warning" | "danger"

const STATUS_TONE_MAP: Record<string, StatusTone> = {
  // assets
  available: "success",
  assigned: "info",
  in_repair: "warning",
  disposed: "danger",
  lost: "danger",
  // conditions
  new: "success",
  good: "success",
  damaged: "warning",
  needs_repair: "danger",
  // tickets
  open: "info",
  in_progress: "info",
  resolved: "success",
  closed: "success",
  // priorities
  low: "success",
  medium: "warning",
  high: "warning",
  critical: "danger",
  // movements / purchases / generic
  pending: "warning",
  approved: "success",
  rejected: "danger",
  completed: "success",
  overdue: "danger",
  active: "success",
  trialing: "info",
  past_due: "warning",
  canceled: "danger",
  sent: "success",
  failed: "danger",
  // licenses
  expiring_soon: "warning",
  expired: "danger",
  cancelled: "danger",
}

export function toneForStatus(status: string): StatusTone {
  return STATUS_TONE_MAP[status] ?? "info"
}

export const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-status-success/15 text-status-success border-status-success/30",
  info: "bg-status-info/15 text-status-info border-status-info/30",
  warning: "bg-status-warning/15 text-status-warning border-status-warning/30",
  danger: "bg-status-danger/15 text-status-danger border-status-danger/30",
}

export function classesForStatus(status: string) {
  return TONE_CLASSES[toneForStatus(status)]
}
