/**
 * One-off: sets `productType` on assets created before product types
 * existed, inferred from their free-text `category`. Safe to re-run — only
 * touches assets whose productType is still null.
 *
 *   npx tsx scripts/backfill-product-types.ts          # dry run
 *   npx tsx scripts/backfill-product-types.ts --apply
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import mongoose from "mongoose"
import { inferProductType } from "../lib/constants/product-types"

async function main() {
  const apply = process.argv.includes("--apply")
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("MONGODB_URI is not set in .env.local")
  await mongoose.connect(uri)

  // Raw collection access: this is an intentional cross-tenant admin job,
  // so it bypasses the tenant-guard plugin rather than the models.
  const assets = mongoose.connection.collection("assets")
  const cursor = assets.find(
    { $or: [{ productType: null }, { productType: { $exists: false } }] },
    { projection: { _id: 1, category: 1 } }
  )

  const counts: Record<string, number> = {}
  const ops = []
  for await (const doc of cursor) {
    const type = inferProductType(doc.category)
    counts[type] = (counts[type] ?? 0) + 1
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { productType: type } } } })
  }

  console.table(counts)
  if (apply && ops.length > 0) {
    const res = await assets.bulkWrite(ops)
    console.log(`Updated ${res.modifiedCount} assets.`)
  } else {
    console.log(`${ops.length} assets would be updated. Re-run with --apply to write.`)
  }
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
