import { connectDB } from "@/lib/db"
import { EmployeeInviteToken } from "@/models/EmployeeInviteToken"
import { Company } from "@/models/Company"
import { Branch } from "@/models/Branch"
import { hashInviteToken } from "@/lib/employee-invite"
import { Boxes } from "lucide-react"
import { OnboardForm } from "./onboard-form"

export default async function EmployeeOnboardPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  await connectDB()
  const invite = await EmployeeInviteToken.findOne({
    tokenHash: hashInviteToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).setOptions({ skipTenantGuard: true })

  if (!invite) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <h1 className="text-lg font-semibold">This invite link is invalid or has expired</h1>
        <p className="text-sm text-muted-foreground">Ask your IT team to send you a new one.</p>
      </div>
    )
  }

  const companyId = invite.companyId.toString()
  const [company, branches] = await Promise.all([
    Company.findById(companyId).setOptions({ skipTenantGuard: true }),
    Branch.find({ companyId }),
  ])

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Boxes className="h-6 w-6 text-primary" />
        AssetFlow
      </div>

      <div>
        <h1 className="text-xl font-semibold">Welcome to {company?.name ?? "your company"}</h1>
        <p className="text-muted-foreground">
          {invite.email ? (
            <>
              You&apos;re setting up an account for <strong>{invite.email}</strong>.
            </>
          ) : (
            "Set up your AssetFlow account below."
          )}{" "}
          Right after this, we&apos;ll get your computer registered too — it only takes a couple
          minutes total.
        </p>
      </div>

      <OnboardForm
        token={token}
        prefilledEmail={invite.email ?? null}
        branches={branches.map((b) => ({ _id: b._id.toString(), name: b.name }))}
      />
    </div>
  )
}
