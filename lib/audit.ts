import { AuditLog } from "@/models/AuditLog"

/**
 * Records who changed what, when — the kind of thing enterprise security
 * reviews ask for. Best-effort: a logging failure should never fail the
 * request it's describing, so callers fire-and-forget this (no await
 * needed, but it's safe to await too).
 */
export async function writeAuditLog(entry: {
  companyId: string
  userId: string
  action: string
  entityType: string
  entityId: string
  changes?: Record<string, unknown> | null
  request?: Request
}) {
  try {
    const ipAddress = entry.request
      ? entry.request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        entry.request.headers.get("x-real-ip") ??
        null
      : null

    await AuditLog.create({
      companyId: entry.companyId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: entry.changes ?? null,
      ipAddress,
    })
  } catch (err) {
    console.error("Failed to write audit log", err)
  }
}
