import { Warehouse } from "lucide-react"
import { ComingSoon } from "@/components/coming-soon"

export default function InventoryPage() {
  return (
    <ComingSoon
      icon={Warehouse}
      title="Inventory"
      description="Stock levels by category and branch, with reorder alerts."
    />
  )
}
