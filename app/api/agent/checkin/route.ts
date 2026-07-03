import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { checkinSchema } from "@/lib/validations/agent"
import { hashToken } from "@/lib/agent/tokens"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(req: Request) {
  const ip = getClientIp(req)
  // Generous limit — legitimate check-ins are ~every 20 min, but several
  // devices behind one NAT'd office IP can all land here.
  const { allowed } = checkRateLimit(`agent-checkin:${ip}`, 200, 15 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 })
  }

  const authHeader = req.headers.get("authorization") ?? ""
  const deviceApiKey = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!deviceApiKey) {
    return NextResponse.json({ error: "Missing device API key" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = checkinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }
  const { hardware } = parsed.data

  await connectDB()

  // The key is the only thing identifying which company/asset this is —
  // an intentional, narrow cross-tenant lookup (same pattern as looking
  // up a user by email at login).
  const asset = await Asset.findOne({ "agent.deviceApiKeyHash": hashToken(deviceApiKey) }).setOptions({
    skipTenantGuard: true,
  })

  if (!asset) {
    return NextResponse.json({ error: "Unknown or revoked device key" }, { status: 401 })
  }

  asset.agent.cpu = hardware.cpu ?? asset.agent.cpu
  asset.agent.ramGb = hardware.ramGb ?? asset.agent.ramGb
  asset.agent.storageGb = hardware.storageGb ?? asset.agent.storageGb
  asset.agent.os = hardware.os ?? asset.agent.os
  asset.agent.ipAddress = hardware.ipAddress ?? asset.agent.ipAddress
  asset.agent.macAddress = hardware.macAddress ?? asset.agent.macAddress
  asset.agent.loggedInUser = hardware.loggedInUser ?? asset.agent.loggedInUser
  asset.agent.hostname = hardware.hostname ?? asset.agent.hostname
  asset.agent.lastCheckInAt = new Date()
  await asset.save()

  return NextResponse.json({ ok: true })
}
