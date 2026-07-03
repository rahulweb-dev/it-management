import mongoose, { Schema } from "mongoose"

/**
 * Groups several Company tenants together (e.g. a holding company with
 * subsidiaries). Purely organizational — each Company is still its own
 * fully isolated tenant (own branches/employees/assets/tickets). Being in
 * the same Organization only grants IT Persons a read-across-siblings
 * view and the ability to create an asset directly under a sibling
 * company; it never merges the underlying data or access control.
 */
const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
)

export const Organization =
  mongoose.models.Organization || mongoose.model("Organization", OrganizationSchema)
