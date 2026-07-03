import { connectDB } from "@/lib/db"
import { DeviceEnrollmentToken } from "@/models/DeviceEnrollmentToken"
import { User } from "@/models/User"
import { hashToken } from "@/lib/agent/tokens"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Boxes, Laptop, AppWindow } from "lucide-react"

export default async function AgentInstallPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  await connectDB()
  const enrollment = await DeviceEnrollmentToken.findOne({
    tokenHash: hashToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).setOptions({ skipTenantGuard: true })

  const employee = enrollment
    ? await User.findOne({ _id: enrollment.employeeId }).setOptions({ skipTenantGuard: true })
    : null

  if (!enrollment || !employee) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <h1 className="text-lg font-semibold">This link is invalid or has expired</h1>
        <p className="text-sm text-muted-foreground">
          Ask your IT team to send you a new install link.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Boxes className="h-6 w-6 text-primary" />
        AssetFlow
      </div>

      <div>
        <h1 className="text-xl font-semibold">Hi {employee.name.split(" ")[0]}, set up your device</h1>
        <p className="text-muted-foreground">
          Download and run the installer for your computer below. It registers this machine in
          AssetFlow and keeps its hardware info up to date automatically — no further action needed
          after this.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <AppWindow className="h-6 w-6" />
            <CardTitle className="text-base">Windows</CardTitle>
            <CardDescription>Downloads a .bat file</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href={`/api/agent/installer/windows/${token}`} download>
                Download for Windows
              </a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Laptop className="h-6 w-6" />
            <CardTitle className="text-base">Mac</CardTitle>
            <CardDescription>Downloads a .command file</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href={`/api/agent/installer/mac/${token}`} download>
                Download for Mac
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">How to run it</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Windows</p>
            <p>
              Open your Downloads folder and double-click{" "}
              <code className="rounded bg-background px-1 py-0.5 text-xs">
                AssetFlowAgent-Install.bat
              </code>
              . If a blue &quot;Windows protected your PC&quot; popup appears, click{" "}
              <strong>More info</strong> then <strong>Run anyway</strong> — this is normal for a
              new internal tool that isn&apos;t yet code-signed.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Mac</p>
            <p>
              Open your Downloads folder and double-click{" "}
              <code className="rounded bg-background px-1 py-0.5 text-xs">
                AssetFlowAgent-Install.command
              </code>
              . If macOS blocks it, right-click the file, choose <strong>Open</strong>, then
              confirm <strong>Open</strong> again in the dialog.
            </p>
          </div>
          <p>This link works once and expires in 48 hours.</p>
        </CardContent>
      </Card>
    </div>
  )
}
