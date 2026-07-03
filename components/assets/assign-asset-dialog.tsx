"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { assignAssetSchema, type AssignAssetInput } from "@/lib/validations/asset"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

type Employee = { _id: string; name: string; email: string }

export function AssignAssetDialog({
  open,
  onOpenChange,
  assetId,
  companyId,
  onAssigned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string | null
  companyId?: string | null
  onAssigned: () => void
}) {
  const [employees, setEmployees] = useState<Employee[]>([])

  const form = useForm<AssignAssetInput>({
    resolver: zodResolver(assignAssetSchema),
    defaultValues: { userId: "", notes: "" },
  })

  useEffect(() => {
    if (open) {
      form.reset()
      const params = companyId ? `?companyId=${companyId}` : ""
      fetch(`/api/employees${params}`)
        .then((res) => res.json())
        .then((data) => setEmployees(data.items ?? []))
    }
  }, [open, form, companyId])

  async function onSubmit(values: AssignAssetInput) {
    if (!assetId) return
    const res = await fetch(`/api/assets/${assetId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Failed to assign asset")
      return
    }

    toast.success("Asset assigned")
    onOpenChange(false)
    onAssigned()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign asset</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e._id} value={e._id}>
                          {e.name} — {e.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Handover notes, accessories included, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Assign
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
