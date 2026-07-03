import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { ProfileForm } from "./profile-form"

export default async function ProfilePage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-muted-foreground">Your account details.</p>
      </div>
      <ProfileForm
        name={session.user.name}
        email={session.user.email}
        role={session.user.role}
        backHref={session.user.role === "platform_admin" ? "/platform" : "/dashboard"}
      />
    </div>
  )
}
