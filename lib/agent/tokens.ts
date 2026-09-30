import crypto from "crypto"

const ENROLLMENT_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours

/** Exact shape of a raw enrollment token (24 random bytes, hex). */
export const ENROLLMENT_TOKEN_PATTERN = /^[a-f0-9]{48}$/

export function createEnrollmentToken() {
  const rawToken = crypto.randomBytes(24).toString("hex")
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MS)
  return { rawToken, tokenHash, expiresAt }
}

/** Long-lived credential the agent saves locally after enrolling, used on every check-in. */
export function createDeviceApiKey() {
  const rawKey = crypto.randomBytes(32).toString("hex")
  const keyHash = hashToken(rawKey)
  return { rawKey, keyHash }
}

export function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex")
}
