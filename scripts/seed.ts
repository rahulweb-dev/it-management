import { config } from "dotenv"
config({ path: ".env.local" })

import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { Company } from "@/models/Company"
import { Branch } from "@/models/Branch"
import { User } from "@/models/User"
import { PlatformAdmin } from "@/models/PlatformAdmin"
import { slugify } from "@/lib/utils"

const DEMO_PASSWORD = "password123"

// Emails from an earlier role model (super_admin/branch_manager/it_admin)
// that no longer exist as valid company roles — clean them out so the
// demo company only ever has current-model accounts.
const STALE_DEMO_EMAILS = ["admin@demo.com", "manager@demo.com", "itadmin@demo.com"]

async function seed() {
  await connectDB()

  const removed = await User.deleteMany({ email: { $in: STALE_DEMO_EMAILS } }).setOptions({
    skipTenantGuard: true,
  })
  if (removed.deletedCount) {
    console.log(`Removed ${removed.deletedCount} stale demo user(s) from an earlier role model`)
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)

  // --- Platform admin ---
  let platformAdmin = await PlatformAdmin.findOne({ email: "platform@demo.com" })
  if (!platformAdmin) {
    platformAdmin = await PlatformAdmin.create({
      name: "Platform Admin",
      email: "platform@demo.com",
      passwordHash,
    })
    console.log(`Created platform_admin  platform@demo.com`)
  } else {
    console.log(`Skipping platform@demo.com — already exists`)
  }

  // --- Demo company ---
  const companyName = "Demo Co"
  const slug = slugify(companyName)

  let company = await Company.findOne({ slug })
  if (!company) {
    company = await Company.create({
      name: companyName,
      slug,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
    console.log(`Created company "${companyName}" (${company._id})`)
  } else {
    console.log(`Reusing existing company "${companyName}" (${company._id})`)
  }

  let branch = await Branch.findOne({ companyId: company._id, name: "Head Office" })
  if (!branch) {
    branch = await Branch.create({
      companyId: company._id,
      name: "Head Office",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
    })
    console.log(`Created branch "Head Office" (${branch._id})`)
  }

  const DEMO_USERS = [
    { name: "Ivy ITPerson", email: "itperson@demo.com", role: "it_person" as const },
    { name: "Dana Employee", email: "employee@demo.com", role: "employee" as const },
  ]

  for (const u of DEMO_USERS) {
    const existing = await User.findOne({ email: u.email }).setOptions({ skipTenantGuard: true })
    if (existing) {
      console.log(`Skipping ${u.email} — already exists`)
      continue
    }
    await User.create({
      companyId: company._id,
      name: u.name,
      email: u.email,
      passwordHash,
      role: u.role,
      branchId: branch._id,
      department: u.role === "employee" ? "Engineering" : null,
      isActive: true,
    })
    console.log(`Created ${u.role.padEnd(10)} ${u.email}`)
  }

  console.log("\nDemo logins (password for all: " + DEMO_PASSWORD + "):")
  console.log(`  platform_admin  platform@demo.com`)
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role.padEnd(14)} ${u.email}`)
  }

  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})



// Role	Email	Password
// Platform Admin	platform@demo.com	password123
// IT Person (Demo Co)	itperson@demo.com	newpassword456 
// Employee (Demo Co)	employee@demo.com	password123