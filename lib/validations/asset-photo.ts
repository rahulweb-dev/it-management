import { z } from "zod"

export const addPhotoSchema = z.object({
  fileName: z.string().min(1).max(200),
  // Data URL or raw base64 — decoded server-side into a Buffer before upload.
  dataBase64: z.string().min(1),
})

export const removePhotoSchema = z.object({
  url: z.string().min(1),
})

export type AddPhotoInput = z.infer<typeof addPhotoSchema>
export type RemovePhotoInput = z.infer<typeof removePhotoSchema>
