import mongoose, { Schema } from "mongoose"

const CounterSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company" },
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
})

CounterSchema.index({ companyId: 1, key: 1 }, { unique: true })

export const Counter =
  mongoose.models.Counter || mongoose.model("Counter", CounterSchema)

/** Atomically issues the next sequence number for a company-scoped counter. */
export async function nextSequence(companyId: string, key: string) {
  const doc = await Counter.findOneAndUpdate(
    { companyId, key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  )
  return doc.seq as number
}

export function formatSequence(prefix: string, seq: number, padLength = 4) {
  return `${prefix}${String(seq).padStart(padLength, "0")}`
}
