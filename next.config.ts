import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// script-src/style-src keep 'unsafe-inline' because a per-request nonce
// (the fully-strict approach) needs a browser to verify end-to-end and
// this was authored without one — breaking every page silently is worse
// than a slightly looser script-src. Everything else here is a real,
// meaningful restriction: no framing, no third-party script/connect
// destinations, no plugins.
const cspDirectives = [
  "default-src 'self'",
  // 'unsafe-eval' is needed in dev only — Next's dev bundler and React
  // Fast Refresh use eval() for hot-reloading. Without it here, dev-mode
  // client JS silently fails to hydrate: dropdowns don't open, forms fall
  // back to native browser submission. Production doesn't need it.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // upload.imagekit.io: client uploads go browser -> ImageKit directly,
  // never through our server (see lib/imagekit.ts).
  `connect-src 'self' https://upload.imagekit.io${isProd ? "" : " ws:"}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
]

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
]

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
};

export default nextConfig;
