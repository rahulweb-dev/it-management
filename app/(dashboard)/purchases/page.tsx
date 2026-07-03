import { ShoppingCart } from "lucide-react"
import { ComingSoon } from "@/components/coming-soon"

export default function PurchasesPage() {
  return (
    <ComingSoon
      icon={ShoppingCart}
      title="Purchases"
      description="Purchase orders, vendors, and invoice records."
    />
  )
}
