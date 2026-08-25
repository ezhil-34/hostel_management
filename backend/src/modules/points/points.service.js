import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

import prisma from '../../config/prisma.js';
import env from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';

export const OVERSIGHT_ROLES = ['WARDEN', 'ADMIN'];

/** Wrong PINs allowed before the wallet locks. */
const PIN_ATTEMPT_LIMIT = 5;
/** How long it stays locked. Long enough to kill a script, short enough to forgive. */
const PIN_LOCK_MINUTES = 15;

const reference = () => `PTS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const counterToken = () => crypto.randomBytes(16).toString('hex');

/**
 * A bcrypt hash of nothing in particular, compared against when a wallet has no
 * PIN set. Returning early instead would make "no PIN" answer in 2ms and "wrong
 * PIN" in 300ms — the gap tells an attacker which wallets are unprotected.
 * Generated once at the configured cost so it matches a real comparison.
 */
const DUMMY_PIN_HASH = bcrypt.hashSync('0000', env.bcryptRounds);

// ---------------------------------------------------------------------------
// Serialisers — nothing leaves this module as a raw Prisma row.
// ---------------------------------------------------------------------------

const serializeTransaction = (t) => ({
  id: t.id,
  reference: t.reference,
  title: t.title,
  points: t.points,
  type: t.type,
  counterName: t.counterName,
  actorName: t.actorName,
  note: t.note,
  balanceAfter: t.balanceAfter,
  createdAt: t.createdAt,
});

const serializeWallet = (w) => ({
  id: w.id,
  type: w.type,
  balance: w.balance,
  // The hash itself never leaves the server; the UI only needs to know whether
  // to ask the student to set one.
  hasPin: Boolean(w.pinHash),
  lockedUntil: w.pinLockedUntil && w.pinLockedUntil > new Date() ? w.pinLockedUntil : null,
  transactions: (w.transactions ?? []).map(serializeTransaction),
});

const serializeMenuItem = (i) => ({ id: i.id, name: i.name, points: i.points });

const serializeCounter = (c) => ({
  id: c.id,
  name: c.name,
  type: c.type,
  items: (c.items ?? []).map(serializeMenuItem),
});

const walletSelect = {
  id: true,
  type: true,
  balance: true,
  pinHash: true,
  pinAttempts: true,
  pinLockedUntil: true,
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Both wallets with their recent history.
 *
 * Wallets are created at signup, but a student who predates that — or any
 * staff account that wanders onto the page — would have none. Rather than
 * showing an error we create what is missing, since an empty wallet is the
 * correct state for someone who has never been credited.
 */
export const getWallets = async (userId, { limit = 20 } = {}) => {
  const existing = await prisma.wallet.findMany({ where: { userId }, select: { type: true } });
  const missing = ['CANTEEN', 'LAUNDRY'].filter((t) => !existing.some((w) => w.type === t));

  if (missing.length) {
    await prisma.wallet.createMany({
      data: missing.map((type) => ({ userId, type })),
      skipDuplicates: true,
    });
  }

  const wallets = await prisma.wallet.findMany({
    where: { userId },
    select: {
      ...walletSelect,
      transactions: { orderBy: { createdAt: 'desc' }, take: limit },
    },
    orderBy: { type: 'asc' },
  });

  return wallets.map(serializeWallet);
};

export const getHistory = async (userId, { type, limit }) => {
  const transactions = await prisma.pointTransaction.findMany({
    where: {
      wallet: { userId, ...(type === 'ALL' ? {} : { type }) },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return transactions.map(serializeTransaction);
};

/**
 * Resolves a scanned QR code to a counter and its menu.
 *
 * Only available items come back, and the price comes from here rather than
 * from anything the browser sends — the client's job is to show a menu, not to
 * decide what a samosa costs.
 */
export const getCounterByToken = async (token) => {
  const counter = await prisma.counter.findUnique({
    where: { qrToken: token },
    select: {
      id: true,
      name: true,
      type: true,
      isActive: true,
      items: {
        where: { isAvailable: true },
        orderBy: { points: 'asc' },
        select: { id: true, name: true, points: true },
      },
    },
  });

  if (!counter || !counter.isActive) {
    throw ApiError.notFound('That code does not match an open counter.');
  }

  return serializeCounter(counter);
};

/** The counters a student can scan. Backs the picker that stands in for a camera. */
export const listCounters = async () => {
  const counters = await prisma.counter.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, type: true, qrToken: true },
  });
  return counters;
};

// ---------------------------------------------------------------------------
// The PIN
// ---------------------------------------------------------------------------

const lockRemaining = (wallet) => {
  if (!wallet.pinLockedUntil) return 0;
  const ms = wallet.pinLockedUntil.getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
};

/**
 * Checks a PIN and records the attempt.
 *
 * Every failure increments a counter; the limit locks the wallet for a while.
 * Four digits is 10,000 possibilities, which a script exhausts in minutes
 * against an endpoint that answers as fast as it can.
 */
const verifyPin = async (wallet) => {
  const locked = lockRemaining(wallet);
  if (locked > 0) {
    throw ApiError.forbidden(
      `Too many wrong PINs. This wallet is locked for another ${locked} minute${locked === 1 ? '' : 's'}.`,
    );
  }
  if (!wallet.pinHash) {
    throw ApiError.badRequest('Set a spending PIN before using your points.');
  }
};

const recordPinResult = async (wallet, correct) => {
  if (correct) {
    if (wallet.pinAttempts !== 0 || wallet.pinLockedUntil) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { pinAttempts: 0, pinLockedUntil: null },
      });
    }
    return;
  }

  const attempts = wallet.pinAttempts + 1;
  const reached = attempts >= PIN_ATTEMPT_LIMIT;

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      pinAttempts: reached ? 0 : attempts,
      pinLockedUntil: reached ? new Date(Date.now() + PIN_LOCK_MINUTES * 60000) : null,
    },
  });

  if (reached) {
    throw ApiError.forbidden(
      `That PIN was wrong ${PIN_ATTEMPT_LIMIT} times. This wallet is locked for ${PIN_LOCK_MINUTES} minutes.`,
    );
  }

  const left = PIN_ATTEMPT_LIMIT - attempts;
  /**
   * 403, not 401, and the distinction matters.
   *
   * 401 means "your session is not valid", and the browser's API client answers
   * it by refreshing the token and replaying the request. A wrong PIN answered
   * with 401 was therefore posted twice — one tap, two failed attempts, and a
   * wallet that locked after three tries instead of five. A rejected action is
   * 403.
   */
  throw ApiError.forbidden(
    `That PIN is not right. ${left} attempt${left === 1 ? '' : 's'} left before the wallet locks.`,
  );
};

/**
 * Sets or replaces the spending PIN on both wallets at once.
 *
 * One PIN for the student, not one per wallet — two four-digit PINs to
 * remember is how people end up writing them on the back of their ID card.
 */
export const setPin = async (userId, { pin, password }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw ApiError.notFound('Account not found');

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  // 403 for the same reason as a wrong PIN: the session is fine, the action is
  // refused. A 401 here would be replayed by the browser's API client.
  if (!passwordOk) throw ApiError.forbidden('That is not your account password.');

  const pinHash = await bcrypt.hash(pin, env.bcryptRounds);

  await prisma.wallet.updateMany({
    where: { userId },
    data: { pinHash, pinAttempts: 0, pinLockedUntil: null },
  });

  return { message: 'Spending PIN saved. You will need it for every purchase.' };
};

// ---------------------------------------------------------------------------
// Spending — the part that must not go wrong
// ---------------------------------------------------------------------------

/**
 * Debits a wallet for one menu item.
 *
 * The balance is never read, decided on, and then written — that gap is where
 * a double-tap or two phones spend the same points twice. Instead the check
 * lives inside the write:
 *
 *     UPDATE wallets SET balance = balance - :cost
 *      WHERE id = :id AND balance >= :cost
 *
 * `count === 0` means the wallet no longer had the points, whoever got there
 * first. The ledger row is written in the same transaction, so a balance can
 * never move without a receipt explaining it.
 */
export const spend = async (userId, actorName, { counterToken: token, itemId, pin, idempotencyKey }) => {
  const counter = await prisma.counter.findUnique({
    where: { qrToken: token },
    select: { id: true, name: true, type: true, isActive: true },
  });
  if (!counter || !counter.isActive) {
    throw ApiError.notFound('That code does not match an open counter.');
  }

  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    select: { id: true, name: true, points: true, isAvailable: true, counterId: true },
  });
  if (!item || item.counterId !== counter.id) {
    throw ApiError.notFound('That item is not on this counter’s menu.');
  }
  if (!item.isAvailable) {
    throw ApiError.conflict(`${item.name} has just gone off the menu.`);
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId_type: { userId, type: counter.type } },
    select: walletSelect,
  });
  if (!wallet) throw ApiError.notFound('You do not have a wallet for that counter.');

  await verifyPin(wallet);
  const pinOk = await bcrypt.compare(pin, wallet.pinHash ?? DUMMY_PIN_HASH);
  await recordPinResult(wallet, pinOk);

  // A retry of a request that already went through returns the original
  // receipt rather than charging again.
  if (idempotencyKey) {
    const seen = await prisma.pointTransaction.findFirst({
      where: { walletId: wallet.id, reference: `PTS-${idempotencyKey.slice(0, 6).toUpperCase()}` },
    });
    if (seen) return { transaction: serializeTransaction(seen), balance: seen.balanceAfter, replayed: true };
  }

  const cost = item.points;

  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: cost } },
      data: { balance: { decrement: cost } },
    });

    if (count === 0) {
      // Read the balance only to write a useful message — the decision was
      // already made, atomically, above.
      const now = await tx.wallet.findUnique({
        where: { id: wallet.id },
        select: { balance: true },
      });
      throw ApiError.conflict(
        `Not enough points. ${item.name} costs ${cost} and you have ${now?.balance ?? 0}.`,
        { balance: now?.balance ?? 0, required: cost },
      );
    }

    const after = await tx.wallet.findUnique({
      where: { id: wallet.id },
      select: { balance: true },
    });

    const transaction = await tx.pointTransaction.create({
      data: {
        walletId: wallet.id,
        reference: idempotencyKey ? `PTS-${idempotencyKey.slice(0, 6).toUpperCase()}` : reference(),
        title: item.name,
        points: cost,
        type: 'DEBIT',
        counterName: counter.name,
        actorName,
        balanceAfter: after.balance,
      },
    });

    return { transaction, balance: after.balance };
  });

  return {
    transaction: serializeTransaction(result.transaction),
    balance: result.balance,
    replayed: false,
  };
};

// ---------------------------------------------------------------------------
// Crediting — warden and admin only
// ---------------------------------------------------------------------------

/**
 * Adds points to a student's wallet.
 *
 * A credit is not the mirror image of a debit: there is no ceiling to check,
 * so an unconditional increment is correct and two credits at once should both
 * land. The `increment` still keeps it a single statement rather than a
 * read-modify-write, so neither can overwrite the other.
 */
export const credit = async (actor, { identifier, type, points, note }) => {
  const student = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        { rollNumber: { equals: identifier, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, rollNumber: true, email: true, role: true },
  });

  if (!student) {
    throw ApiError.notFound(`No account matches “${identifier}”.`);
  }

  const wallet = await prisma.wallet.upsert({
    where: { userId_type: { userId: student.id, type } },
    create: { userId: student.id, type, balance: 0 },
    update: {},
    select: { id: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: points } },
      select: { balance: true },
    });

    const transaction = await tx.pointTransaction.create({
      data: {
        walletId: wallet.id,
        reference: reference(),
        title: note,
        points,
        type: 'CREDIT',
        actorName: actor.name,
        note,
        balanceAfter: updated.balance,
      },
    });

    return { transaction, balance: updated.balance };
  });

  return {
    student: {
      id: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      email: student.email,
    },
    type,
    balance: result.balance,
    transaction: serializeTransaction(result.transaction),
    message: `${points} points added to ${student.name}’s ${type.toLowerCase()} wallet.`,
  };
};

/** Warden and admin lookup: find a student and see both balances. */
export const lookupStudent = async ({ q }) => {
  if (!q) return { students: [] };

  const students = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { rollNumber: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 10,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      rollNumber: true,
      email: true,
      roomNo: true,
      wallets: { select: { type: true, balance: true } },
    },
  });

  return {
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      rollNumber: s.rollNumber,
      email: s.email,
      roomNo: s.roomNo,
      balances: Object.fromEntries(s.wallets.map((w) => [w.type, w.balance])),
    })),
  };
};

export { counterToken };
