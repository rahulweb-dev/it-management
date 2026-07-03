import mongoose, { Schema } from "mongoose"
import { tenantScoped } from "@/lib/mongoose/tenantPlugin"
import { COMPANY_ROLES } from "@/lib/constants/enums"
export type { CompanyRole } from "@/lib/constants/enums"

const UserSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: "Company", index: true },
    employeeCode: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: null },
    role: { type: String, enum: COMPANY_ROLES, required: true, default: "employee" },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null },
    department: { type: String, default: null },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    joiningDate: { type: Date, default: null },
    avatar: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
)

UserSchema.index({ companyId: 1, employeeCode: 1 })

UserSchema.plugin(tenantScoped)

export const User = mongoose.models.User || mongoose.model("User", UserSchema)
