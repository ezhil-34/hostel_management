import crypto from 'node:crypto';
import prisma from '../../config/prisma.js';
import ApiError from '../../utils/ApiError.js';
import env from '../../config/env.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../../utils/jwt.js';

/** Fields safe to return to the client — never includes passwordHash. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  rollNumber: true,
  phone: true,
  role: true,
  roomNo: true,
  hostelBlock: true,
  createdAt: true,
};

/**
 * A valid bcrypt hash that no password produces, generated at the *configured*
 * cost so a failed lookup takes as long as a failed comparison. A fixed literal
 * would not work: if its cost differed from BCRYPT_ROUNDS, response timing
 * would give away whether an account exists.
 */
const dummyHash = hashPassword(crypto.randomUUID());

const MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** "7d" -> 604800000. Falls back to 7 days for anything unparseable. */
const ttlToMs = (ttl) => {
  const match = /^(\d+)\s*([smhd])$/.exec(String(ttl).trim());
  return match ? Number(match[1]) * MS[match[2]] : 7 * MS.d;
};

export const refreshTtlMs = ttlToMs(env.jwt.refreshTtl);

const issueTokens = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtlMs),
    },
  });

  return { accessToken, refreshToken };
};

export const signup = async (input) => {
  const { password, ...rest } = input;

  const clash = await prisma.user.findFirst({
    where: { OR: [{ email: rest.email }, { rollNumber: rest.rollNumber }] },
    select: { email: true, rollNumber: true },
  });

  if (clash) {
    throw ApiError.conflict(
      clash.email === rest.email
        ? 'An account with this email already exists'
        : 'An account with this roll number already exists',
    );
  }

  const user = await prisma.user.create({
    data: {
      ...rest,
      passwordHash: await hashPassword(password),
      // Every student starts with a canteen and a laundry wallet.
      wallets: {
        create: [
          { type: 'CANTEEN', balance: 0 },
          { type: 'LAUNDRY', balance: 0 },
        ],
      },
    },
    select: publicUserSelect,
  });

  const tokens = await issueTokens(user);
  return { user, ...tokens };
};

export const signin = async ({ identifier, password }) => {
  const isEmail = identifier.includes('@');

  const user = await prisma.user.findUnique({
    where: isEmail
      ? { email: identifier.toLowerCase() }
      : { rollNumber: identifier.toUpperCase() },
  });

  // Same message either way so the endpoint cannot be used to enumerate accounts.
  const invalid = ApiError.unauthorized('Invalid credentials');
  if (!user) {
    // Burn a comparable amount of time so a missing account is not detectable
    // by response timing. The hash below matches no password.
    await verifyPassword(password, await dummyHash);
    throw invalid;
  }

  if (!(await verifyPassword(password, user.passwordHash))) throw invalid;
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  const { passwordHash: _ignored, isActive: _active, updatedAt: _updated, ...safe } = user;
  const tokens = await issueTokens(user);
  return { user: safe, ...tokens };
};

export const refresh = async (token) => {
  if (!token) throw ApiError.unauthorized('No refresh token provided');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token is no longer valid');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { ...publicUserSelect, isActive: true },
  });

  if (!user || !user.isActive) throw ApiError.unauthorized('Account no longer active');

  // Rotate: the old token is retired the moment a new one is issued.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const { isActive: _active, ...safe } = user;
  const tokens = await issueTokens(safe);
  return { user: safe, ...tokens };
};

export const logout = async (token) => {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const getProfile = (userId) =>
  prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });

/**
 * Changes the password and signs out every *other* session.
 *
 * `currentRefreshToken` is the token belonging to the device making the change;
 * it is spared, so the person doing this stays signed in — which is what the UI
 * promises them. Revoking it too would silently drop them out as soon as their
 * 15-minute access token expired.
 */
export const changePassword = async (
  userId,
  { currentPassword, newPassword },
  currentRefreshToken,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  const keepHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
    prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keepHash ? { NOT: { tokenHash: keepHash } } : {}),
      },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { keptCurrentSession: Boolean(keepHash) };
};
