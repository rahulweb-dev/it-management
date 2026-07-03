import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { Company } from "@/models/Company"
import { Organization } from "@/models/Organization"
import { User } from "@/models/User"
import { requireSession, handleApiError } from "@/lib/api"
import { assertPlatformAdmin } from "@/lib/rbac"
import { createCompanySchema } from "@/lib/validations/platform"
import { slugify } from "@/lib/utils"
import { writeAuditLog } from "@/lib/audit"
import { getStorageStatus } from "@/lib/storage"

export async function GET() {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertPlatformAdmin(session)
    await connectDB()

    const companies = await Company.find({ deletedAt: null })
      .populate("organizationId", "name")
      .sort({ createdAt: -1 })
    const companyIds = companies.map((c) => c._id)

    const itPeople = await User.find({
      companyId: { $in: companyIds },
      role: "it_person",
    })
      .select("companyId name email")
      .setOptions({ skipTenantGuard: true })

    const employeeCounts = await User.aggregate([
      { $match: { companyId: { $in: companyIds }, deletedAt: null } },
      { $group: { _id: "$companyId", count: { $sum: 1 } } },
    ])

    const itPersonByCompany = new Map(itPeople.map((u) => [u.companyId.toString(), u]))
    const countByCompany = new Map(employeeCounts.map((e: any) => [e._id.toString(), e.count]))

    const items = await Promise.all(
      companies.map(async (c) => ({
        ...c.toObject(),
        itPerson: itPersonByCompany.get(c._id.toString()) ?? null,
        userCount: countByCompany.get(c._id.toString()) ?? 0,
        storage: await getStorageStatus(c._id.toString()),
      }))
    )

    return NextResponse.json({ items })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: Request) {
  const { session, response } = await requireSession()
  if (!session) return response

  try {
    assertPlatformAdmin(session)
    const body = await req.json()
    const parsed = createCompanySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { companyName, itPersonName, itPersonEmail, itPersonPassword, plan, organizationName } =
      parsed.data

    await connectDB()

    const existing = await User.findOne({ email: itPersonEmail }).setOptions({
      skipTenantGuard: true,
    })
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    const baseSlug = slugify(companyName) || "company"
    let slug = baseSlug
    let suffix = 1
    while (await Company.findOne({ slug })) {
      slug = `${baseSlug}-${suffix++}`
    }

    // Find-or-create by name (case-insensitive) so typing the same
    // organization name for a second company groups them together instead
    // of silently creating a duplicate org.
    let organizationId = null
    const trimmedOrgName = organizationName?.trim()
    if (trimmedOrgName) {
      let organization = await Organization.findOne({
        name: { $regex: `^${trimmedOrgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      })
      if (!organization) {
        organization = await Organization.create({ name: trimmedOrgName })
      }
      organizationId = organization._id
    }

    const company = await Company.create({
      name: companyName,
      slug,
      plan,
      organizationId,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })

    const passwordHash = await bcrypt.hash(itPersonPassword, 12)
    const itPerson = await User.create({
      companyId: company._id,
      name: itPersonName,
      email: itPersonEmail,
      passwordHash,
      role: "it_person",
      isActive: true,
    })

    writeAuditLog({
      companyId: company._id.toString(),
      userId: session.user.id,
      action: "company.created",
      entityType: "Company",
      entityId: company._id.toString(),
      changes: { name: company.name, itPersonEmail },
      request: req,
    })

    const { passwordHash: _omit, ...safeItPerson } = itPerson.toObject()
    return NextResponse.json({ item: { company, itPerson: safeItPerson } }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
