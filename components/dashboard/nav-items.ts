import type { Role } from "@/lib/constants/enums"
import {
  LayoutDashboard,
  Boxes,
  Ticket,
  Warehouse,
  Users,
  Building2,
  ShoppingCart,
  BarChart3,
  KeyRound,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  roles: Role[]
}

const ALL: Role[] = ["it_person", "employee"]

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ALL },
  { label: "Assets", href: "/assets", icon: Boxes, roles: ALL },
  { label: "Tickets", href: "/tickets", icon: Ticket, roles: ALL },
  { label: "Inventory", href: "/inventory", icon: Warehouse, roles: ["it_person"] },
  { label: "Employees", href: "/employees", icon: Users, roles: ["it_person"] },
  { label: "Branches", href: "/branches", icon: Building2, roles: ["it_person"] },
  { label: "Licenses", href: "/licenses", icon: KeyRound, roles: ["it_person"] },
  { label: "Purchases", href: "/purchases", icon: ShoppingCart, roles: ["it_person"] },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["it_person"] },
]
