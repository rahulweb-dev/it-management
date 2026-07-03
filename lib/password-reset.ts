import crypto from "crypto"

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

/** Raw token goes in the email link; only its hash is ever stored in the DB. */
export function createResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = hashResetToken(rawToken)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
  return { rawToken, tokenHash, expiresAt }
}

export function hashResetToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex")
}
