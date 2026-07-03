import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { DeviceEnrollmentToken } from "@/models/DeviceEnrollmentToken"
import { nextSequence, formatSequence } from "@/models/Counter"
import { enrollSchema } from "@/lib/validations/agent"
import { hashToken, createDeviceApiKey } from "@/lib/agent/tokens"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const { allowed } = checkRateLimit(`agent-enroll:${ip}`, 20, 15 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = enrollSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }
  const { token, platform, hardware } = parsed.data

  await connectDB()

  const enrollment = await DeviceEnrollmentToken.findOne({
    tokenHash: hashToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).setOptions({ skipTenantGuard: true })

  if (!enrollment) {
    return NextResponse.json({ error: "This install link is invalid or has expired." }, { status: 400 })
  }

  const companyId = enrollment.companyId.toString()

  // Re-running the installer on an already-enrolled machine (same serial
  // number) should update that asset, not create a duplicate.
  let asset = hardware.serialNumber
    ? await Asset.findOne({ companyId, serialNumber: hardware.serialNumber })
    : null

  const { rawKey, keyHash } = createDeviceApiKey()

  if (asset) {
    asset.assignedTo = enrollment.employeeId
    asset.branchId = enrollment.branchId
    asset.status = "assigned"
  } else {
    const seq = await nextSequence(companyId, "asset")
    asset = new Asset({
      companyId,
      assetId: formatSequence("AST", seq),
      assetName: [hardware.manufacturer, hardware.model].filter(Boolean).join(" ") || "Unnamed device",
      category: hardware.deviceType === "desktop" ? "Desktop" : "Laptop",
      condition: "good",
      status: "assigned",
      branchId: enrollment.branchId,
      assignedTo: enrollment.employeeId,
    })
  }

  asset.brand = hardware.manufacturer || asset.brand
  asset.model = hardware.model || asset.model
  asset.serialNumber = hardware.serialNumber || asset.serialNumber
  asset.agent = {
    enrolled: true,
    deviceApiKeyHash: keyHash,
    hostname: hardware.hostname ?? null,
    cpu: hardware.cpu ?? null,
    ramGb: hardware.ramGb ?? null,
    storageGb: hardware.storageGb ?? null,
    os: hardware.os ?? null,
    ipAddress: hardware.ipAddress ?? null,
    macAddress: hardware.macAddress ?? null,
    loggedInUser: hardware.loggedInUser ?? null,
    agentPlatform: platform,
    lastCheckInAt: new Date(),
  }
  await asset.save()

  enrollment.usedAt = new Date()
  await enrollment.save()

  writeAuditLog({
    companyId,
    userId: enrollment.employeeId.toString(),
    action: "device.enrolled",
    entityType: "Asset",
    entityId: asset._id.toString(),
    changes: { platform, hostname: hardware.hostname },
  })

  return NextResponse.json({
    deviceApiKey: rawKey,
    assetId: asset.assetId,
    checkInIntervalMinutes: 20,
  })
}
