import crypto from 'node:crypto';
import prisma from '../../config/prisma.js';
import env from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { WALLET_TYPES } from './points.schema.js';

/** Roles allowed to top up a wallet directly and to generate secret payment QRs. */
export const ADMIN_ROLES = ['WARDEN', 'ADMIN'];

/** How long a generated payment QR stays scannable before it must be reissued. */
const QR_TTL_MS = 15 * 60 * 1000;

const walletSelect = { id: true, type: true, balance: true, updatedAt: true };

const newReference = () => `PTS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/** Same shape as an outpass verify token — a long random bearer capability. */
const newToken = () => crypto.randomBytes(32).toString('base64url');

const assertWalletType = (type) => {
  if (!WALLET_TYPES.includes(type)) {
    throw ApiError.badRequest(`walletType must be one of ${WALLET_TYPES.join(', ')}`);
  }
};

/**
 * Looks up one of the two wallets every student is given at signup (see
 * auth.service.js). Not `findUnique` on a composite key on purpose — this
 * module does not assume the exact name Prisma gives that constraint, only
 * that (userId, type) is unique in practice.
 */
const getWalletForUpdate = async (tx, userId, type) => {
  const wallet = await tx.wallet.findFirst({ where: { userId, type } });
  if (!wallet) throw ApiError.notFound(`No ${type.toLowerCase()} wallet for this account`);
  return wallet;
};

// ---------------------------------------------------------------------------
// Wallets & spending history — every signed-in user, own data only
// ---------------------------------------------------------------------------

export const getOwnWallets = (userId) =>
  prisma.wallet.findMany({ where: { userId }, select: walletSelect, orderBy: { type: 'asc' } });

const transactionSelect = {
  id: true,
  type: true,
  amount: true,
  balanceAfter: true,
  title: true,
  createdAt: true,
  wallet: { select: { type: true } },
};

export const listOwnTransactions = (userId, { walletType, limit }) =>
  prisma.walletTransaction.findMany({
    where: {
      userId,
      ...(walletType && walletType !== 'ALL' ? { wallet: { type: walletType } } : {}),
    },
    select: transactionSelect,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

// ---------------------------------------------------------------------------
// Payment PIN — set once, then required for every spend
// ---------------------------------------------------------------------------

export const pinStatus = async (userId) => {
  const pin = await prisma.paymentPin.findUnique({ where: { userId } });
  return { hasPin: Boolean(pin) };
};

export const setPin = async (userId, pin) => {
  const existing = await prisma.paymentPin.findUnique({ where: { userId } });
  if (existing) {
    throw ApiError.conflict('A PIN is already set for this account — use change PIN instead');
  }

  await prisma.paymentPin.create({ data: { userId, pinHash: await hashPassword(pin) } });
  return { message: 'Payment PIN set' };
};

export const changePin = async (userId, { currentPin, newPin }) => {
  const existing = await prisma.paymentPin.findUnique({ where: { userId } });
  if (!existing) throw ApiError.badRequest('No PIN set yet — set one first');

  if (!(await verifyPassword(currentPin, existing.pinHash))) {
    throw ApiError.badRequest('Current PIN is incorrect');
  }

  await prisma.paymentPin.update({
    where: { userId },
    data: { pinHash: await hashPassword(newPin) },
  });
  return { message: 'Payment PIN updated' };
};

/** Throws the same message whether a PIN was never set or was typed wrong up
 * to the point of comparison — callers still get a specific "not set" message
 * before the value is checked, since that is guidance, not a security leak. */
const verifyOwnPin = async (userId, pin) => {
  const row = await prisma.paymentPin.findUnique({ where: { userId } });
  if (!row) throw ApiError.badRequest('Set a payment PIN before paying with points');
  if (!(await verifyPassword(pin, row.pinHash))) throw ApiError.unauthorized('Incorrect PIN');
};

// ---------------------------------------------------------------------------
// Secret payment QR — admin/vendor fills the amount, student scans & pays
// ---------------------------------------------------------------------------

const qrSelect = {
  id: true,
  reference: true,
  walletType: true,
  amount: true,
  title: true,
  status: true,
  expiresAt: true,
  paidAt: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true, role: true } },
  paidBy: { select: { id: true, name: true, rollNumber: true, roomNo: true } },
};

/**
 * The single place derived fields are computed — mirrors
 * outpass.service.js#serializeOutpass. `token` is never returned except right
 * after creation, when only the admin who just generated it sees it (as the
 * URL baked into the QR image).
 */
const serializeQr = (qr, { includeToken = false } = {}) => {
  if (!qr) return qr;
  const { token, ...rest } = qr;
  const isExpired = rest.status === 'PENDING' && new Date(rest.expiresAt) < new Date();
  return {
    ...rest,
    isExpired,
    qrUrl: includeToken && token ? `${env.appPublicUrl}/points/pay/${token}` : null,
  };
};

export const createQrCode = async (adminId, { walletType, amount, title }) => {
  assertWalletType(walletType);

  const label =
    title || `${walletType.charAt(0)}${walletType.slice(1).toLowerCase()} purchase — ${amount} pts`;

  const qr = await prisma.pointsQrCode.create({
    data: {
      reference: newReference(),
      token: newToken(),
      walletType,
      amount,
      title: label,
      status: 'PENDING',
      createdById: adminId,
      expiresAt: new Date(Date.now() + QR_TTL_MS),
    },
    select: { ...qrSelect, token: true },
  });

  return serializeQr(qr, { includeToken: true });
};

export const listOwnQrCodes = async (adminId, { status }) => {
  const rows = await prisma.pointsQrCode.findMany({
    where: { createdById: adminId, ...(status && status !== 'ALL' ? { status } : {}) },
    select: qrSelect,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => serializeQr(row));
};

export const cancelQrCode = async (adminId, id) => {
  const qr = await prisma.pointsQrCode.findUnique({ where: { id } });
  if (!qr || qr.createdById !== adminId) throw ApiError.notFound('Payment code not found');

  if (qr.status !== 'PENDING') {
    throw ApiError.badRequest(`This payment code was already ${qr.status.toLowerCase()}`);
  }

  // Compare-and-swap — the student may be paying it at this exact moment.
  const { count } = await prisma.pointsQrCode.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  if (count === 0) {
    throw ApiError.conflict('This payment code was just used — refresh to see the outcome');
  }

  return serializeQr(await prisma.pointsQrCode.findUnique({ where: { id }, select: qrSelect }));
};

const findByToken = async (token) => {
  const qr = await prisma.pointsQrCode.findUnique({ where: { token } });
  if (!qr) {
    throw ApiError.notFound('This payment code is not valid. Ask the counter to generate a new one.');
  }
  return qr;
};

/** What the student sees on the pay screen after scanning — no PIN yet. */
export const previewQrCode = async (token) => serializeQr(await findByToken(token));

/**
 * Charges the scanning student's own wallet for a pending QR.
 *
 * Two students scanning a screenshot of the same code, or one student
 * double-tapping Pay, must debit the wallet at most once — the QR's PENDING
 * status is the thing being compare-and-swapped, exactly like outpass's gate
 * actions.
 */
export const payQrCode = async (userId, token, pin) => {
  await verifyOwnPin(userId, pin);

  const qr = await findByToken(token);

  if (qr.status !== 'PENDING') {
    throw ApiError.badRequest(`This payment code was already ${qr.status.toLowerCase()}`);
  }

  if (new Date(qr.expiresAt) < new Date()) {
    // Best-effort label flip so the counter's list stops showing it as live;
    // failing this is not a reason to fail the more important error below.
    await prisma.pointsQrCode
      .updateMany({ where: { id: qr.id, status: 'PENDING' }, data: { status: 'EXPIRED' } })
      .catch(() => {});
    throw ApiError.badRequest('This payment code has expired — ask the counter to generate a new one');
  }

  const { wallet, transaction } = await prisma.$transaction(async (tx) => {
    // Claim the code first: if this fails, nothing else runs and no points move.
    const claimed = await tx.pointsQrCode.updateMany({
      where: { id: qr.id, status: 'PENDING' },
      data: { status: 'PAID', paidById: userId, paidAt: new Date() },
    });
    if (claimed.count === 0) {
      throw ApiError.conflict('This payment code was just used — ask the counter to check');
    }

    const found = await getWalletForUpdate(tx, userId, qr.walletType);
    if (found.balance < qr.amount) {
      throw ApiError.badRequest(`Insufficient ${qr.walletType.toLowerCase()} points balance`);
    }

    const updatedWallet = await tx.wallet.update({
      where: { id: found.id },
      data: { balance: { decrement: qr.amount } },
      select: walletSelect,
    });

    const createdTransaction = await tx.walletTransaction.create({
      data: {
        walletId: found.id,
        userId,
        type: 'DEBIT',
        amount: qr.amount,
        balanceAfter: updatedWallet.balance,
        title: qr.title,
        qrCodeId: qr.id,
      },
      select: transactionSelect,
    });

    return { wallet: updatedWallet, transaction: createdTransaction };
  });

  const paidQr = await prisma.pointsQrCode.findUnique({ where: { id: qr.id }, select: qrSelect });
  return { wallet, transaction, qr: serializeQr(paidQr) };
};

// ---------------------------------------------------------------------------
// Admin: top up a student's wallet directly (recharge, not a purchase)
// ---------------------------------------------------------------------------

const studentSelect = {
  id: true,
  name: true,
  rollNumber: true,
  roomNo: true,
  hostelBlock: true,
  role: true,
  isActive: true,
};

export const topUpWallet = async (adminId, { rollNumber, walletType, amount, note }) => {
  assertWalletType(walletType);

  const student = await prisma.user.findUnique({
    where: { rollNumber: rollNumber.toUpperCase() },
    select: studentSelect,
  });
  if (!student) throw ApiError.notFound('No account found with that roll number');
  if (!student.isActive) throw ApiError.badRequest('This account has been deactivated');

  const { wallet, transaction } = await prisma.$transaction(async (tx) => {
    const found = await getWalletForUpdate(tx, student.id, walletType);

    const updatedWallet = await tx.wallet.update({
      where: { id: found.id },
      data: { balance: { increment: amount } },
      select: walletSelect,
    });

    const createdTransaction = await tx.walletTransaction.create({
      data: {
        walletId: found.id,
        userId: student.id,
        type: 'CREDIT',
        amount,
        balanceAfter: updatedWallet.balance,
        title: note || `Points added by ${walletType.toLowerCase()} admin`,
        createdById: adminId,
      },
      select: transactionSelect,
    });

    return { wallet: updatedWallet, transaction: createdTransaction };
  });

  const { isActive: _ignored, ...safeStudent } = student;
  return { wallet, transaction, student: safeStudent };
};
