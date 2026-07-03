# AssetFlow

Multi-tenant IT asset & helpdesk management SaaS. Next.js 15 (App Router) + Tailwind v4 + shadcn/ui + MongoDB/Mongoose + NextAuth v5 + ImageKit + Nodemailer.

Every Mongoose query must be scoped by `companyId` derived from the session — never trust a `companyId` from the client. See `lib/rbac.ts` for `getScopedFilter()`.
