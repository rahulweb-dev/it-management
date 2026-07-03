import nodemailer from "nodemailer"
import { templates, type EmailTemplate } from "./templates"
import { EmailLog } from "@/models/EmailLog"

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!process.env.SMTP_HOST) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  }
  return transporter
}

/**
 * Sends a templated email and always logs the attempt to EmailLog, so
 * failures are visible in the app instead of silently disappearing.
 * No-ops (but still logs) when SMTP isn't configured yet.
 */
export async function sendMail(opts: {
  companyId: string
  to: string
  template: EmailTemplate
  data: Record<string, any>
}) {
  const { subject, html } = templates[opts.template](opts.data)
  const client = getTransporter()

  try {
    if (!client) {
      throw new Error("SMTP is not configured. Add SMTP_HOST to .env.local")
    }
    await client.sendMail({
      from: process.env.SMTP_FROM ?? "AssetFlow <no-reply@assetflow.app>",
      to: opts.to,
      subject,
      html,
    })
    await EmailLog.create({
      companyId: opts.companyId,
      to: opts.to,
      template: opts.template,
      subject,
      status: "sent",
    })
    return { sent: true }
  } catch (err: any) {
    await EmailLog.create({
      companyId: opts.companyId,
      to: opts.to,
      template: opts.template,
      subject,
      status: "failed",
      error: err.message,
    })
    return { sent: false, error: err.message }
  }
}
