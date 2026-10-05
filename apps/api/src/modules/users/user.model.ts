import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ROLES, type UserDTO } from '@store/shared';

export const AddressSchema = new Schema(
  {
    label: { type: String, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true, // creates a unique index
    },
    // select: false keeps the hash out of every query unless explicitly requested.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'customer', index: true },
    addresses: { type: [AddressSchema], default: [] },
    // Expo / FCM device tokens for push notifications.
    pushTokens: { type: [String], default: [], select: false },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof UserSchema>;
export type UserDocument = HydratedDocument<User>;

export function toUserDTO(u: UserDocument): UserDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    addresses: u.addresses.map((a) => ({
      label: a.label ?? undefined,
      line1: a.line1,
      line2: a.line2 ?? undefined,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      phone: a.phone ?? undefined,
    })),
    createdAt: u.createdAt.toISOString(),
  };
}

export const UserModel = model('User', UserSchema);
