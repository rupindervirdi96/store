import { Schema, model } from 'mongoose';

/**
 * A sign-up waiting for its emailed code. The User is only created once the
 * code is verified, so unverified addresses never become accounts.
 */
const PendingRegistrationSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  name: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  // HMAC of the code; the code itself is never stored.
  codeHash: { type: String, required: true, select: false },
  codeExpiresAt: { type: Date, required: true },
  lastSentAt: { type: Date, required: true },
  failedAttempts: { type: Number, default: 0 },
  // TTL: abandoned sign-ups are deleted by MongoDB a day later.
  purgeAt: { type: Date, required: true, expires: 0 },
});

export const PendingRegistrationModel = model('PendingRegistration', PendingRegistrationSchema);
