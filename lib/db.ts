import mongoose from "mongoose"

// Side-effect import: registers every Mongoose model up front, so a route
// that only imports e.g. User but calls .populate("branchId") doesn't hit
// "Schema hasn't been registered for model Branch" just because nothing
// else in that request's module graph happened to import Branch first.
import "@/models"

declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: {
    conn: typeof mongoose | null
    promise: Promise<typeof mongoose> | null
  } | undefined
}

const cached = global._mongooseConn ?? { conn: null, promise: null }
global._mongooseConn = cached

export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local")
  }

  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}
