import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Asset } from "@/models/Asset"
import { License } from "@/models/License"
import { User } from "@/models/User"
import { Notification } from "@/models/Notification"
import { sendMail } from "@/lib/mail"
import type { EmailTemplate } from "@/lib/mail/templates"
import type { NOTIFICATION_TYPES } from "@/lib/constants/enums"

const DAY_MS = 24 * 60 * 60 * 1000
// Fixed lookahead for asset warranty/AMC — unlike licenses, assets don't
// have a per-item configurable reminder window.
const WARRANTY_AMC_REMINDER_DAYS = 30

/**
 * No session exists when an external scheduler calls this — auth is a
 * shared secret instead. Fails closed if CRON_SECRET was never set, so a
 * misconfigured deployment can't accidentally run this open to the world.
 */
function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const url = new URL(req.url)
  const provided = req.headers.get("x-cron-secret") ?? url.searchParams.get("secret")
  return provided === secret
}

async function notifyItPeople(opts: {
  companyId: string
  type: (typeof NOTIFICATION_TYPES)[number]
  message: string
  template: EmailTemplate
  data: Record<string, any>
}) {
  const itPeople = await User.find({
    companyId: opts.companyId,
    role: "it_person",
    isActive: true,
    deletedAt: null,
  }).setOptions({ skipTenantGuard: true })

  await Promise.all(
    itPeople.map(async (itPerson: any) => {
      await Notification.create({
        companyId: opts.companyId,
        userId: itPerson._id,
        type: opts.type,
        message: opts.message,
        link: opts.data.link ?? null,
      })
      await sendMail({
        companyId: opts.companyId,
        to: itPerson.email,
        template: opts.template,
        data: opts.data,
      }).catch(() => {})
    })
  )
}

/**
 * Hit daily by an external scheduler (Vercel Cron / GitHub Actions / a
 * plain cron-job.org ping) — there's no in-process job runner here.
 * Scans across every company (skipTenantGuard is intentional: this is a
 * background sweep, not a request scoped to one tenant) for assets and
 * licenses entering their reminder window, notifies each company's IT
 * Person(s) once per expiry date, and records that a reminder went out so
 * it isn't repeated every day for the rest of the window.
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await connectDB()
  const now = new Date()
  const appBase = process.env.APP_BASE_URL ?? ""
  const warrantyAmcWindowEnd = new Date(now.getTime() + WARRANTY_AMC_REMINDER_DAYS * DAY_MS)
  const results = { warranty: 0, amc: 0, license: 0 }

  const expiringWarranty = await Asset.find({
    warrantyExpiry: { $gte: now, $lte: warrantyAmcWindowEnd },
    warrantyReminderSentAt: null,
    deletedAt: null,
  }).setOptions({ skipTenantGuard: true })

  for (const asset of expiringWarranty) {
    const daysLeft = Math.ceil((asset.warrantyExpiry.getTime() - now.getTime()) / DAY_MS)
    await notifyItPeople({
      companyId: asset.companyId.toString(),
      type: "warranty",
      message: `${asset.assetName} (${asset.assetId}) warranty expires in ${daysLeft} day(s)`,
      template: "warranty-expiring",
      data: {
        assetName: asset.assetName,
        assetId: asset.assetId,
        daysLeft,
        expiryDate: asset.warrantyExpiry.toDateString(),
        link: `${appBase}/assets`,
      },
    })
    asset.warrantyReminderSentAt = now
    await asset.save()
    results.warranty++
  }

  const expiringAmc = await Asset.find({
    amcExpiry: { $gte: now, $lte: warrantyAmcWindowEnd },
    amcReminderSentAt: null,
    deletedAt: null,
  }).setOptions({ skipTenantGuard: true })

  for (const asset of expiringAmc) {
    const daysLeft = Math.ceil((asset.amcExpiry.getTime() - now.getTime()) / DAY_MS)
    await notifyItPeople({
      companyId: asset.companyId.toString(),
      type: "amc",
      message: `${asset.assetName} (${asset.assetId}) AMC expires in ${daysLeft} day(s)`,
      template: "amc-expiring",
      data: {
        assetName: asset.assetName,
        assetId: asset.assetId,
        daysLeft,
        expiryDate: asset.amcExpiry.toDateString(),
        link: `${appBase}/assets`,
      },
    })
    asset.amcReminderSentAt = now
    await asset.save()
    results.amc++
  }

  // Licenses each have their own reminderDaysBefore, so the window can't be
  // pushed into the query the way it is above — fetch every not-yet-expired,
  // not-yet-reminded license and filter per-document instead.
  const candidateLicenses = await License.find({
    cancelled: false,
    lastReminderSentAt: null,
    expiryDate: { $gte: now },
    deletedAt: null,
  }).setOptions({ skipTenantGuard: true })

  for (const license of candidateLicenses) {
    const daysLeft = Math.ceil((license.expiryDate.getTime() - now.getTime()) / DAY_MS)
    if (daysLeft > license.reminderDaysBefore) continue

    await notifyItPeople({
      companyId: license.companyId.toString(),
      type: "license",
      message: `${license.name} (${license.vendor}) expires in ${daysLeft} day(s)`,
      template: "license-expiring",
      data: {
        name: license.name,
        vendor: license.vendor,
        daysLeft,
        expiryDate: license.expiryDate.toDateString(),
        link: `${appBase}/licenses`,
      },
    })
    license.lastReminderSentAt = now
    await license.save()
    results.license++
  }

  return NextResponse.json({ ok: true, remindersSent: results })
}
