import bcrypt from 'bcryptjs';
import type { AuthResponse } from '@store/shared';
import { AppError } from '../../utils/AppError';
import { signToken } from '../../utils/jwt';
import { UserModel, toUserDTO, type UserDocument } from '../users/user.model';
import type { LoginInput, RegisterInput } from './auth.schemas';

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

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const exists = await UserModel.exists({ email: input.email });
  if (exists) throw AppError.conflict('An account with this email already exists');

  // Public registration always creates customers; admins come from the seed
  // script or an existing admin.
  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: 'customer',
  });
  return issue(user);
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw AppError.unauthorized('Invalid email or password');
  return issue(user);
}
