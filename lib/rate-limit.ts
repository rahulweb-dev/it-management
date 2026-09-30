/**
 * Simple in-memory fixed-window rate limiter. Good enough for a single
 * Node.js server instance (or dev). If you deploy across multiple
 * instances/regions, swap the Map for a shared store (Redis/Upstash) —
 * each instance here has its own independent counters.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Periodically drop expired buckets so this doesn't grow unbounded.
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}, 60_000).unref?.()

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now }
  }

  bucket.count += 1
  return { allowed: true, remaining: limit - bucket.count }
}

/**
 * Client IP for rate limiting. Each proxy *appends* the address it saw to
 * X-Forwarded-For, so anything to the left of our own proxies' entries was
 * written by the client and can be spoofed — taking the first entry let an
 * attacker get a fresh rate-limit bucket per request. Instead count
 * TRUSTED_PROXY_HOPS entries from the right (default 1: one load balancer
 * or platform edge in front of the app). Hosts that overwrite the header
 * with a single value (e.g. Vercel) work with the default too.
 */
export function getClientIp(request: Request) {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1)
  const entries = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (entries.length > 0) return entries[Math.max(0, entries.length - hops)]
  return request.headers.get("x-real-ip") ?? "unknown"
}
