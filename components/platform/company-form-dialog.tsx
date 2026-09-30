"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { createCompanySchema, type CreateCompanyInput } from "@/lib/validations/platform"
import { PLAN_STORAGE_GB } from "@/lib/plans"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

const NONE = "__none"
const NEW = "__new"

export function CompanyFormDialog({
  open,
  onOpenChange,
  onSaved,
  organizations,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  organizations: { _id: string; name: string }[]
}) {
  const [orgChoice, setOrgChoice] = useState(NONE)
  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      companyName: "",
      itPersonName: "",
      itPersonEmail: "",
      itPersonPassword: "",
      plan: "starter",
      organizationId: "",
      organizationName: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset()
      setOrgChoice(NONE)
    }
  }, [open, form])

  async function onSubmit(values: CreateCompanyInput) {
    const res = await fetch("/api/platform/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Failed to create company")
      return
    }

    toast.success("Company created")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create company</DialogTitle>
          <DialogDescription>
            This creates the company and its first IT Person account, who signs in and takes it
            from there — adding branches, employees, and assets themselves.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="itPersonName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IT Person name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="itPersonEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IT Person email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="it@acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="itPersonPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temporary password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="At least 8 characters" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem>
              <FormLabel>Organization</FormLabel>
              <Select
                value={orgChoice}
                onValueChange={(v) => {
                  setOrgChoice(v)
                  form.setValue("organizationId", v === NONE || v === NEW ? "" : v)
                  if (v !== NEW) form.setValue("organizationName", "")
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Standalone company</SelectItem>
                  {organizations.map((o) => (
                    <SelectItem key={o._id} value={o._id}>
                      Join {o.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW}>New organization…</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Companies in the same organization can be managed by one IT Person, who can then see
                all of their data — only join a group this customer actually belongs to.
              </p>
            </FormItem>
            {orgChoice === NEW && (
              <FormField
                control={form.control}
                name="organizationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New organization name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Acme Group" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="plan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(PLAN_STORAGE_GB).map(([plan, gb]) => (
                        <SelectItem key={plan} value={plan} className="capitalize">
                          {plan} — {gb} GB storage
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Create company
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
