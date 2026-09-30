import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { User } from "@/models/User"
import { AssetAssignmentHistory } from "@/models/AssetAssignmentHistory"
import { DeviceEnrollmentToken } from "@/models/DeviceEnrollmentToken"
import { nextSequence, formatSequence } from "@/models/Counter"
import { enrollSchema } from "@/lib/validations/agent"
import { hashToken, createDeviceApiKey } from "@/lib/agent/tokens"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { writeAuditLog } from "@/lib/audit"
import { HttpError } from "@/lib/api"
import { assertCanAddAssets } from "@/lib/plan-limits"

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

  // Consume the single-use token atomically up front, so two concurrent
  // installs with the same link can't both enroll. Released again below
  // if enrollment is refused, so the employee can retry.
  const enrollment = await DeviceEnrollmentToken.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
    { new: true }
  ).setOptions({ skipTenantGuard: true })

  if (!enrollment) {
    return NextResponse.json({ error: "This install link is invalid or has expired." }, { status: 400 })
  }

  const companyId = enrollment.companyId.toString()
  const refuse = async (error: string, status: number) => {
    await DeviceEnrollmentToken.updateOne({ _id: enrollment._id, companyId }, { usedAt: null })
    return NextResponse.json({ error }, { status })
  }

  const employee = await User.findOne({ _id: enrollment.employeeId, companyId, isActive: true })
  if (!employee) return refuse("This install link is no longer valid. Ask your IT team for a new one.", 400)

  // Re-running the installer on an already-enrolled machine (same serial
  // number) should update that asset, not create a duplicate. But the
  // serial is client-supplied, so it may only match an asset that is
  // unassigned or already this employee's — never pull a device away from
  // someone else (and lock out its real agent by replacing the API key).
  let asset = hardware.serialNumber
    ? await Asset.findOne({ companyId, serialNumber: hardware.serialNumber })
    : null
  if (asset?.assignedTo && !asset.assignedTo.equals(employee._id)) {
    return refuse(
      "This device is registered to another employee in AssetFlow. Ask your IT team to return it to stock first.",
      409
    )
  }
  if (asset && ["disposed", "lost"].includes(asset.status)) {
    return refuse("This device is marked as disposed or lost. Contact your IT team.", 409)
  }
  const newlyAssigned = !asset?.assignedTo

  const { rawKey, keyHash } = createDeviceApiKey()

  if (asset) {
    asset.assignedTo = employee._id
    asset.status = "assigned"
    if (newlyAssigned) asset.branchId = enrollment.branchId
  } else {
    try {
      await assertCanAddAssets(companyId)
    } catch (err) {
      if (err instanceof HttpError) return refuse(err.message, err.status)
      throw err
    }
    const seq = await nextSequence(companyId, "asset")
    asset = new Asset({
      companyId,
      assetId: formatSequence("AST", seq),
      assetName: [hardware.manufacturer, hardware.model].filter(Boolean).join(" ") || "Unnamed device",
      category: hardware.deviceType === "desktop" ? "Desktop" : "Laptop",
      productType: hardware.deviceType === "desktop" ? "desktop" : "laptop",
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

  if (newlyAssigned) {
    await AssetAssignmentHistory.create({
      companyId,
      assetId: asset._id,
      toUserId: employee._id,
      branchId: asset.branchId,
      assignedDate: new Date(),
      // Self-service: the employee enrolled it themselves via their link.
      assignedBy: employee._id,
      notes: "Self-enrolled via device agent — no hand-over inspection recorded",
    })
  }

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
