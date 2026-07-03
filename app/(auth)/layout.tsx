import Link from "next/link"
import { Boxes } from "lucide-react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <Boxes className="h-6 w-6 text-primary" />
        AssetFlow
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
