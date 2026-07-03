import type { Priority } from "@/lib/constants/enums"

// Hours to first-response/resolution SLA, by priority — critical gets
// same-shift turnaround, low gets a full week.
const SLA_HOURS: Record<Priority, number> = {
  critical: 4,
  high: 24,
  medium: 72,
  low: 168,
}

export function computeSlaDeadline(priority: Priority, from: Date = new Date()) {
  return new Date(from.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000)
}

export type SlaState = "ok" | "due-soon" | "breached"

/** Due-soon is the last 20% of the SLA window, or under 2 hours left, whichever is larger. */
export function slaState(deadline: Date | null, priority: Priority, now: Date = new Date()): SlaState {
  if (!deadline) return "ok"
  const msLeft = deadline.getTime() - now.getTime()
  if (msLeft <= 0) return "breached"

  const totalMs = SLA_HOURS[priority] * 60 * 60 * 1000
  const dueSoonThreshold = Math.max(totalMs * 0.2, 2 * 60 * 60 * 1000)
  return msLeft <= dueSoonThreshold ? "due-soon" : "ok"
}
