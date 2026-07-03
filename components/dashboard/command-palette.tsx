"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { NAV_ITEMS } from "./nav-items"
import type { Role } from "@/lib/constants/enums"

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  return tag === "input" || tag === "textarea" || el.isContentEditable
}

export function CommandPalette({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role))

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isTypingTarget(e.target))) {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === "n" && !isTypingTarget(e.target)) {
        e.preventDefault()
        router.push("/tickets?new=1")
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [router])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page, asset, employee, or ticket..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {items.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go("/tickets?new=1")}>Raise a new ticket</CommandItem>
          <CommandItem onSelect={() => go("/assets?new=1")}>Add a new asset</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
