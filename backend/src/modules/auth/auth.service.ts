import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { AUDIT_ACTIONS, ROLES, TRIAL_DAYS, type UserDto } from '@geoagri/shared';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { generateToken, hashToken } from '../../lib/crypto.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../lib/errors.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../lib/mailer.js';
import { env } from '../../config/env.js';

const BCRYPT_ROUNDS = 12;
const VERIFY_TOKEN_TTL_HOURS = 24;
const RESET_TOKEN_TTL_MINUTES = 60;

type UserWithRole = NonNullable<
  Awaited<ReturnType<typeof prisma.user.findUnique<{ where: { id: string }; include: { role: true } }>>>
>;

export function toUserDto(user: UserWithRole): UserDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role.name as UserDto['role'],
    emailVerified: user.emailVerified,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 7 * 24 * 3600 * 1000;
  const n = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return n * unit;
}

export async function issueTokens(
  app: FastifyInstance,
  user: UserWithRole,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = app.jwt.sign({
    sub: user.id,
    email: user.email,
    role: user.role.name,
  });

  const refreshToken = generateToken(48);
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });

  return { accessToken, refreshToken };
}

export interface RegisterParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  ipAddress?: string;
}

/** Register a new farmer account and start the 14-day free trial. */
export async function register(app: FastifyInstance, params: RegisterParams) {
  const existing = await prisma.user.findUnique({ where: { email: params.email } });
  if (existing) throw new ConflictError('An account with this email already exists');

  const farmerRole = await prisma.role.findUnique({ where: { name: ROLES.FARMER } });
  if (!farmerRole) {
    throw new BadRequestError('Platform roles are not seeded. Run the database seed first.');
  }
  const trialPlan = await prisma.plan.findUnique({ where: { slug: 'trial' } });
  if (!trialPlan) {
    throw new BadRequestError('Subscription plans are not seeded. Run the database seed first.');
  }

  const verifyToken = generateToken();
  const user = await prisma.user.create({
    data: {
      email: params.email,
      passwordHash: await bcrypt.hash(params.password, BCRYPT_ROUNDS),
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone ?? null,
      roleId: farmerRole.id,
      emailVerifyToken: verifyToken,
      subscriptions: {
        create: {
          planId: trialPlan.id,
          status: 'TRIAL',
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
        },
      },
    },
    include: { role: true },
  });

  await sendVerificationEmail(user.email, user.firstName, verifyToken);
  await audit({
    userId: user.id,
    action: AUDIT_ACTIONS.USER_REGISTERED,
    resource: 'user',
    resourceId: user.id,
    ipAddress: params.ipAddress,
  });

  const tokens = await issueTokens(app, user);
  return { user: toUserDto(user), tokens };
}

export async function login(
  app: FastifyInstance,
  email: string,
  password: string,
  ipAddress?: string,
) {
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !passwordOk) {
    await audit({
      userId: user?.id,
      action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
      resource: 'user',
      details: { email },
      ipAddress,
    });
    throw new UnauthorizedError('Invalid email or password');
  }
  if (!user.isActive) {
    throw new UnauthorizedError('This account has been disabled. Contact support.');
  }

  await audit({
    userId: user.id,
    action: AUDIT_ACTIONS.USER_LOGIN,
    resource: 'user',
    resourceId: user.id,
    ipAddress,
  });

  const tokens = await issueTokens(app, user);
  return { user: toUserDto(user), tokens };
}

/** Rotate a refresh token: revoke the old one, issue a new pair. */
export async function refresh(app: FastifyInstance, refreshToken: string) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: { include: { role: true } } },
  });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
  if (!record.user.isActive) {
    throw new UnauthorizedError('Account is disabled');
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokens(app, record.user);
  return { user: toUserDto(record.user), tokens };
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function verifyEmail(token: string, ipAddress?: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { emailVerifyToken: token } });
  if (!user) throw new BadRequestError('Invalid or already-used verification link');
  // Enforce token TTL based on account age at first use.
  const tokenAgeMs = Date.now() - user.updatedAt.getTime();
  if (tokenAgeMs > VERIFY_TOKEN_TTL_HOURS * 3_600_000 * 2) {
    // Token is stale — issue a fresh one so the user can retry.
    const fresh = generateToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: fresh },
    });
    await sendVerificationEmail(user.email, user.firstName, fresh);
    throw new BadRequestError('Verification link expired — a new one has been emailed to you');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerifyToken: null },
  });
  await audit({
    userId: user.id,
    action: AUDIT_ACTIONS.EMAIL_VERIFIED,
    resource: 'user',
    resourceId: user.id,
    ipAddress,
  });
}

export async function resendVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  if (user.emailVerified) throw new BadRequestError('Email is already verified');

  const token = generateToken();
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifyToken: token } });
  await sendVerificationEmail(user.email, user.firstName, token);
}

/** Always resolves successfully to avoid leaking which emails are registered. */
export async function forgotPassword(email: string, ipAddress?: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const token = generateToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashToken(token),
      passwordResetExpires: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
    },
  });
  await sendPasswordResetEmail(user.email, user.firstName, token);
  await audit({
    userId: user.id,
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
    resource: 'user',
    resourceId: user.id,
    ipAddress,
  });
}

export async function resetPassword(
  token: string,
  password: string,
  ipAddress?: string,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashToken(token),
      passwordResetExpires: { gt: new Date() },
    },
  });
  if (!user) throw new BadRequestError('Invalid or expired password reset link');

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    }),
    // Revoke all sessions after a password reset.
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await audit({
    userId: user.id,
    action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
    resource: 'user',
    resourceId: user.id,
    ipAddress,
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new BadRequestError('Current password is incorrect');

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
  });
}
