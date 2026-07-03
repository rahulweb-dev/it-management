export type EmailTemplate =
  | "ticket-created"
  | "ticket-status-changed"
  | "ticket-assigned"
  | "asset-assigned"
  | "warranty-expiring"
  | "amc-expiring"
  | "license-expiring"
  | "welcome-new-employee"
  | "weekly-digest"
  | "password-reset"
  | "storage-limit-warning"
  | "agent-install-link"
  | "employee-invite"

type Renderer = (data: Record<string, any>) => { subject: string; html: string }

function wrap(title: string, body: string) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #111827;">${title}</h2>
      ${body}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">Sent by AssetFlow</p>
    </div>
  `
}

export const templates: Record<EmailTemplate, Renderer> = {
  "ticket-created": (d) => ({
    subject: `Ticket ${d.ticketId} created: ${d.description?.slice(0, 60) ?? ""}`,
    html: wrap(
      "New ticket raised",
      `<p><strong>${d.ticketId}</strong> — ${d.issueType} · ${d.priority} priority</p>
       <p>${d.description ?? ""}</p>
       <p><a href="${d.link}">View ticket</a></p>`
    ),
  }),
  "ticket-status-changed": (d) => ({
    subject: `Ticket ${d.ticketId} is now ${d.status}`,
    html: wrap(
      "Ticket status updated",
      `<p><strong>${d.ticketId}</strong> changed to <strong>${d.status}</strong></p>
       <p><a href="${d.link}">View ticket</a></p>`
    ),
  }),
  "ticket-assigned": (d) => ({
    subject: `Ticket ${d.ticketId} assigned to you`,
    html: wrap(
      "Ticket assigned",
      `<p><strong>${d.ticketId}</strong> has been assigned to you.</p>
       <p>${d.description ?? ""}</p>
       <p><a href="${d.link}">View ticket</a></p>`
    ),
  }),
  "asset-assigned": (d) => ({
    subject: `Asset ${d.assetId} assigned to you`,
    html: wrap(
      "Asset assigned",
      `<p><strong>${d.assetName}</strong> (${d.assetId}) has been assigned to you.</p>
       <p><a href="${d.link}">View asset</a></p>`
    ),
  }),
  "warranty-expiring": (d) => ({
    subject: `Warranty expiring in ${d.daysLeft} days: ${d.assetId}`,
    html: wrap(
      "Warranty expiring soon",
      `<p><strong>${d.assetName}</strong> (${d.assetId}) warranty expires on ${d.expiryDate}.</p>
       <p><a href="${d.link}">View asset</a></p>`
    ),
  }),
  "amc-expiring": (d) => ({
    subject: `AMC expiring in ${d.daysLeft} days: ${d.assetId}`,
    html: wrap(
      "AMC expiring soon",
      `<p><strong>${d.assetName}</strong> (${d.assetId}) AMC expires on ${d.expiryDate}.</p>
       <p><a href="${d.link}">View asset</a></p>`
    ),
  }),
  "license-expiring": (d) => ({
    subject: `License expiring in ${d.daysLeft} days: ${d.name}`,
    html: wrap(
      "License expiring soon",
      `<p><strong>${d.name}</strong> (${d.vendor}) expires on ${d.expiryDate}.</p>
       <p><a href="${d.link}">View licenses</a></p>`
    ),
  }),
  "welcome-new-employee": (d) => ({
    subject: `Welcome to ${d.companyName} on AssetFlow`,
    html: wrap(
      `Welcome, ${d.name}`,
      `<p>Your account has been created. Sign in at <a href="${d.link}">${d.link}</a> to view your assigned assets and raise support tickets.</p>`
    ),
  }),
  "weekly-digest": (d) => ({
    subject: `Your weekly AssetFlow digest`,
    html: wrap(
      "Weekly digest",
      `<p>${d.openTickets} open tickets · ${d.expiringWarranties} warranties expiring soon.</p>
       <p><a href="${d.link}">Open dashboard</a></p>`
    ),
  }),
  "password-reset": (d) => ({
    subject: "Reset your AssetFlow password",
    html: wrap(
      "Reset your password",
      `<p>We got a request to reset your password. This link expires in 1 hour.</p>
       <p><a href="${d.link}">Reset password</a></p>
       <p>If you didn't request this, you can safely ignore this email.</p>`
    ),
  }),
  "storage-limit-warning": (d) => ({
    subject: `Storage ${d.percentUsed}% full on your ${d.plan} plan`,
    html: wrap(
      "Storage running low",
      `<p>Your company has used ${d.usedGb} GB of your ${d.limitGb} GB ${d.plan} plan (${d.percentUsed}%).</p>
       <p>Upgrade your plan to avoid interruptions once storage is full.</p>`
    ),
  }),
  "agent-install-link": (d) => ({
    subject: "Set up your AssetFlow device agent",
    html: wrap(
      `Hi ${d.name}`,
      `<p>Your IT team wants to register the computer you're using so it shows up in AssetFlow with its specs kept up to date automatically.</p>
       <p><a href="${d.link}">Install the AssetFlow agent</a></p>
       <p>This link works once and expires in 48 hours. It only collects basic hardware/system info (device model, CPU, RAM, storage, OS, IP/MAC address) — nothing from your files or browsing.</p>`
    ),
  }),
  "employee-invite": (d) => ({
    subject: `You're invited to ${d.companyName} on AssetFlow`,
    html: wrap(
      "Welcome aboard",
      `<p>Your IT team has invited you to set up your AssetFlow account. Fill in your own details —
       it only takes a minute.</p>
       <p><a href="${d.link}">Set up my account</a></p>
       <p>This link works once and expires in 7 days.</p>`
    ),
  }),
}
