"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { assetCreateSchema, type AssetCreateInput } from "@/lib/validations/asset"
import { ASSET_CONDITIONS } from "@/lib/constants/enums"
import { PRODUCT_TYPES, PRODUCT_TYPE_KEYS, type SpecField } from "@/lib/constants/product-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
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

type Branch = { _id: string; name: string }
type Company = { _id: string; name: string }

const STEPS = ["Basic details", "Specifications", "Purchase & warranty"]

const STEP_1_FIELDS = [
  "assetName",
  "productType",
  "category",
  "brand",
  "model",
  "serialNumber",
  "targetCompanyId",
  "branchId",
  "condition",
  "location",
] as const

export function AssetFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { data: session } = useSession()
  const [step, setStep] = useState(1)
  const [branches, setBranches] = useState<Branch[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  const form = useForm<AssetCreateInput>({
    resolver: zodResolver(assetCreateSchema),
    defaultValues: {
      assetName: "",
      productType: undefined,
      category: "",
      specs: {},
      brand: "",
      model: "",
      serialNumber: "",
      targetCompanyId: "",
      branchId: "",
      location: "",
      condition: "new",
      purchaseDate: "",
      purchaseCost: undefined,
      vendor: "",
      warrantyExpiry: "",
      amcExpiry: "",
    },
  })

  const targetCompanyId = form.watch("targetCompanyId")
  const productType = form.watch("productType")
  const specFields: SpecField[] = productType ? PRODUCT_TYPES[productType].specs : []

  useEffect(() => {
    if (open) {
      form.reset()
      setStep(1)
      fetch("/api/organization/companies")
        .then((res) => res.json())
        .then((data) => {
          setCompanies(data.items ?? [])
          if (session?.user.companyId) {
            form.setValue("targetCompanyId", session.user.companyId)
          }
        })
    }
  }, [open, form, session])

  useEffect(() => {
    if (!open) return
    const params = targetCompanyId ? `?companyId=${targetCompanyId}` : ""
    fetch(`/api/branches${params}`)
      .then((res) => res.json())
      .then((data) => setBranches(data.items ?? []))
    form.setValue("branchId", "")
  }, [open, targetCompanyId, form])

  async function goNext() {
    const valid = await form.trigger(STEP_1_FIELDS as unknown as (keyof AssetCreateInput)[])
    if (valid) setStep(specFields.length > 0 ? 2 : 3)
  }

  async function onSubmit(values: AssetCreateInput) {
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Failed to add asset")
      return
    }

    toast.success("Asset added")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add asset</DialogTitle>
          <DialogDescription>
            Step {step} of 3 — {STEPS[step - 1]}
          </DialogDescription>
        </DialogHeader>
        <Progress value={(step / 3) * 100} className="h-1" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {step === 1 && (
              <>
                <FormField
                  control={form.control}
                  name="assetName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset name</FormLabel>
                      <FormControl>
                        <Input placeholder="Dell Latitude 5420" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="productType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product type</FormLabel>
                        <Select
                          onValueChange={(v) => {
                            field.onChange(v)
                            form.setValue("specs", {})
                          }}
                          value={field.value ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PRODUCT_TYPE_KEYS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {PRODUCT_TYPES[t].label}
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
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sub-category (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder={productType === "laptop" ? "Ultrabook" : "e.g. Label printer"} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {productType && (
                  <p className="-mt-2 text-xs text-muted-foreground">
                    Hand-over requires {PRODUCT_TYPES[productType].requiredPhotos.length} photos and a{" "}
                    {PRODUCT_TYPES[productType].checklist.length}-point damage check.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {companies.length > 1 && (
                  <FormField
                    control={form.control}
                    name="targetCompanyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map((c) => (
                              <SelectItem key={c._id} value={c._id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="branchId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {branches.map((b) => (
                              <SelectItem key={b._id} value={b._id}>
                                {b.name}
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
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ASSET_CONDITIONS.map((c) => (
                              <SelectItem key={c} value={c} className="capitalize">
                                {c.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="3rd floor, IT storage" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  {branches.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Add a branch first before adding assets.</p>
                  ) : (
                    <Button type="button" onClick={goNext}>
                      Next
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {specFields.map((spec) => (
                    <FormField
                      key={spec.key}
                      control={form.control}
                      name={`specs.${spec.key}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {spec.label}
                            {spec.unit && <span className="text-muted-foreground"> ({spec.unit})</span>}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type={spec.type === "number" ? "number" : "text"}
                              min={spec.type === "number" ? 0 : undefined}
                              placeholder={spec.placeholder}
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <DialogFooter className="justify-between sm:justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => setStep(3)}>
                    Next
                  </Button>
                </DialogFooter>
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchaseCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase cost</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="warrantyExpiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty expiry</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amcExpiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AMC expiry</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter className="justify-between sm:justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(specFields.length > 0 ? 2 : 1)}>
                    Back
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    Create asset
                  </Button>
                </DialogFooter>
              </>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
