// Agent checks in every ~20 minutes; allow for one missed check-in
// (network hiccup, sleeping laptop) before calling it offline.
const OFFLINE_THRESHOLD_MS = 50 * 60 * 1000

export function deviceStatus(lastCheckInAt: Date | string | null): "online" | "offline" | "never" {
  if (!lastCheckInAt) return "never"
  const elapsed = Date.now() - new Date(lastCheckInAt).getTime()
  return elapsed <= OFFLINE_THRESHOLD_MS ? "online" : "offline"
}
