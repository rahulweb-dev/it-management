import crypto from "crypto"

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function createInviteToken() {
  const rawToken = crypto.randomBytes(24).toString("hex")
  const tokenHash = hashInviteToken(rawToken)
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
  return { rawToken, tokenHash, expiresAt }
}

export function hashInviteToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex")
}
