import bcrypt from 'bcryptjs';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { OTP_LENGTH, type AuthResponse, type VerificationSentResponse } from '@store/shared';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { signToken } from '../../utils/jwt';
import { sendVerificationCode } from '../notifications/email.service';
import { UserModel, toUserDTO, type UserDocument } from '../users/user.model';
import type { LoginInput, RegisterInput, VerifyEmailInput } from './auth.schemas';
import { PendingRegistrationModel } from './pending-registration.model';

const BCRYPT_ROUNDS = 12;

// Compared against when the email is unknown so login timing doesn't reveal
// which addresses have accounts.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-placeholder', BCRYPT_ROUNDS);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function issue(user: UserDocument): AuthResponse {
  return { token: signToken({ sub: user.id, role: user.role }), user: toUserDTO(user) };
}

const CODE_VALID_MINUTES = 10;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const PURGE_AFTER_MS = 24 * 60 * 60 * 1000;

function hashCode(email: string, code: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`${email}:${code}`).digest('hex');
}

function codeMatches(email: string, code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashCode(email, code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function assertCooldownOver(lastSentAt: Date) {
  const waitMs = lastSentAt.getTime() + RESEND_COOLDOWN_MS - Date.now();
  if (waitMs > 0) {
    throw new AppError(429, `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code`);
  }
}

/** Emails a fresh code for a pending sign-up, resetting expiry and attempts. */
async function sendCode(email: string, name: string, extra: { passwordHash?: string } = {}) {
  const code = randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
  const now = Date.now();
  const pending = {
    ...extra,
    name,
    codeHash: hashCode(email, code),
    codeExpiresAt: new Date(now + CODE_VALID_MINUTES * 60 * 1000),
    lastSentAt: new Date(now),
    failedAttempts: 0,
    purgeAt: new Date(now + PURGE_AFTER_MS),
  };
  await PendingRegistrationModel.updateOne({ email }, { $set: pending }, { upsert: true });
  try {
    await sendVerificationCode(email, name, code, CODE_VALID_MINUTES);
  } catch (err) {
    // Nothing was delivered, so allow an immediate retry.
    await PendingRegistrationModel.updateOne({ email }, { $set: { lastSentAt: new Date(0) } });
    throw err;
  }

  const res: VerificationSentResponse = {
    email,
    expiresAt: pending.codeExpiresAt.toISOString(),
    resendAvailableAt: new Date(now + RESEND_COOLDOWN_MS).toISOString(),
  };
  return res;
}

/** Step 1 of sign-up: holds the details and emails a verification code. */
export async function register(input: RegisterInput): Promise<VerificationSentResponse> {
  const exists = await UserModel.exists({ email: input.email });
  if (exists) throw AppError.conflict('An account with this email already exists');

  const pending = await PendingRegistrationModel.findOne({ email: input.email });
  if (pending) assertCooldownOver(pending.lastSentAt);

  return sendCode(input.email, input.name, { passwordHash: await hashPassword(input.password) });
}

export async function resendCode(email: string): Promise<VerificationSentResponse> {
  const pending = await PendingRegistrationModel.findOne({ email });
  if (!pending) throw AppError.notFound('This sign-up has expired. Please register again.');
  assertCooldownOver(pending.lastSentAt);
  return sendCode(email, pending.name);
}

/** Step 2 of sign-up: checks the code and creates the account. */
export async function verifyEmail(input: VerifyEmailInput): Promise<AuthResponse> {
  const pending = await PendingRegistrationModel.findOne({ email: input.email }).select('+passwordHash +codeHash');
  if (!pending) throw AppError.notFound('This sign-up has expired. Please register again.');
  if (pending.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    throw new AppError(429, 'Too many incorrect codes. Request a new code.');
  }
  if (pending.codeExpiresAt.getTime() < Date.now()) {
    throw AppError.badRequest('This code has expired. Request a new code.');
  }
  if (!codeMatches(input.email, input.code, pending.codeHash)) {
    await PendingRegistrationModel.updateOne({ _id: pending._id }, { $inc: { failedAttempts: 1 } });
    const left = MAX_FAILED_ATTEMPTS - pending.failedAttempts - 1;
    throw AppError.badRequest(
      left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many incorrect codes. Request a new code.',
    );
  }

  // Public registration always creates customers; admins come from the seed
  // script or an existing admin. A duplicate email (race) becomes a 409.
  const user = await UserModel.create({
    name: pending.name,
    email: input.email,
    passwordHash: pending.passwordHash,
    role: 'customer',
  });
  await PendingRegistrationModel.deleteOne({ _id: pending._id });
  return issue(user);
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw AppError.unauthorized('Invalid email or password');
  return issue(user);
}
