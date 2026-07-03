import type { Schema } from "mongoose"

/**
 * Every tenant-scoped collection gets this plugin. It does two things
 * structurally, instead of relying on every route author remembering:
 *
 * 1. Refuses to run find/update/delete queries that don't filter by
 *    companyId — a missing filter throws instead of silently returning
 *    (or mutating) another tenant's data.
 * 2. Soft-delete: `deletedAt` is added to every schema, and queries
 *    exclude soft-deleted docs by default.
 *
 * Bypass either guard explicitly and rarely, e.g. an internal admin
 * script: `Model.find(filter).setOptions({ skipTenantGuard: true })`.
 *
 * Hooks are async functions with no `next` callback (Mongoose's modern
 * middleware style — throwing aborts the operation) and `schema` is cast
 * to `any` at the registration call sites because Mongoose's `pre()`
 * overloads don't type-check cleanly against a middleware fn shared
 * across query + aggregate hooks. Correctness here is enforced at
 * runtime, not by the compiler — the rest of the codebase stays typed.
 */

const QUERY_HOOKS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndRemove",
  "countDocuments",
  "updateMany",
  "updateOne",
  "deleteMany",
  "deleteOne",
]

export function tenantScoped(schema: Schema) {
  schema.add({
    deletedAt: { type: Date, default: null },
  })

  ;(schema as any).pre(QUERY_HOOKS, async function (this: any) {
    const options = this.getOptions?.() ?? {}
    const filter = this.getQuery ? this.getQuery() : {}

    // Mongoose's own .populate() runs a sub-query filtered only by
    // `_id: { $in: [...] }` on the referenced collection, with no
    // companyId in scope. Those ids only ever came from a doc field
    // resolved by an already tenant-scoped parent query, so they're
    // safe to exempt — unlike app code, which never queries by bare
    // _id without pairing it with companyId (see route handlers).
    const filterKeys = Object.keys(filter).filter((k) => k !== "deletedAt")
    const isIdOnlyLookup = filterKeys.length === 1 && filterKeys[0] === "_id"

    if (!options.skipTenantGuard && !isIdOnlyLookup && !filter.companyId) {
      throw new Error(
        `Tenant guard: query on "${this.model?.modelName}" is missing a companyId filter. ` +
          `Pass companyId explicitly, or .setOptions({ skipTenantGuard: true }) for an intentional cross-tenant query.`
      )
    }

    if (!options.includeDeleted && filter.deletedAt === undefined) {
      this.where({ deletedAt: null })
    }
  })

  ;(schema as any).pre("aggregate", async function (this: any) {
    const options = this.options ?? {}
    if (options.skipTenantGuard) return

    const pipeline = this.pipeline()
    const hasCompanyMatch = pipeline.some(
      (stage: any) => stage.$match && stage.$match.companyId !== undefined
    )

    if (!hasCompanyMatch) {
      throw new Error(
        `Tenant guard: aggregate on "${this._model?.modelName}" has no $match stage filtering companyId. ` +
          `Add one, or pass { skipTenantGuard: true } via .option() for an intentional cross-tenant aggregate.`
      )
    }
  })

  schema.methods.softDelete = function (this: any) {
    this.deletedAt = new Date()
    return this.save()
  }

  schema.methods.restore = function (this: any) {
    this.deletedAt = null
    return this.save()
  }
}
