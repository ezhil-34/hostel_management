import crypto from 'node:crypto';
import prisma from '../../config/prisma.js';
import env from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';

/** Roles allowed to review passes, and to work the gate. */
export const REVIEWER_ROLES = ['WARDEN', 'ADMIN'];
export const GATE_ROLES = ['SECURITY', 'WARDEN', 'ADMIN'];

/**
 * A pass in one of these states *may* occupy the student's one open slot — but
 * only while its window is still live. See `openPassFilter`.
 */
const OPEN_STATUSES = ['PENDING', 'APPROVED', 'ACTIVE'];

/** How early the gate will let a student out, relative to their leave time. */
const EARLY_EXIT_GRACE_MS = 30 * 60 * 1000;

/**
 * What counts as "you already have a pass".
 *
 * A PENDING or APPROVED pass whose return time has come and gone was never
 * used — it is dead, and must not lock the student out of requesting another
 * one forever. An ACTIVE pass always blocks, however late it is: the student is
 * physically out and has to be checked back in first.
 */
const openPassFilter = (userId) => ({
  userId,
  OR: [
    { status: 'ACTIVE' },
    { status: { in: ['PENDING', 'APPROVED'] }, returnAt: { gte: new Date() } },
  ],
});

/** A never-used pass whose window has closed. Derived, like `isOverdue`. */
const isExpiredPass = (outpass) =>
  ['PENDING', 'APPROVED'].includes(outpass.status) && new Date(outpass.returnAt) < new Date();

const outpassSelect = {
  id: true,
  reference: true,
  roomNo: true,
  destination: true,
  reason: true,
  leaveAt: true,
  returnAt: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  verifyToken: true,
  exitedAt: true,
  returnedAt: true,
  createdAt: true,
  user: { select: { id: true, name: true, rollNumber: true, phone: true, roomNo: true } },
  reviewer: { select: { id: true, name: true, role: true } },
};

const newReference = () => `OUT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/**
 * Applies a state change only if the row is still in the status we checked.
 *
 * Every transition here is a read-then-write: we fetch the pass, decide it is
 * (say) APPROVED, then update. Two requests can interleave between those two
 * steps — two guards scanning the same QR, a warden double-clicking Approve —
 * and both would write. Putting the expected status in the WHERE clause makes
 * the decision and the write one atomic statement, so exactly one wins.
 *
 * Returns the updated row, or null if someone else got there first.
 */
const transition = async (id, fromStatus, data) => {
  const { count } = await prisma.outpass.updateMany({
    where: { id, status: fromStatus },
    data,
  });

  if (count === 0) return null;

  return prisma.outpass.findUnique({ where: { id }, select: outpassSelect });
};

const newVerifyToken = () => crypto.randomBytes(32).toString('base64url');

/**
 * The single place derived fields are computed, so no caller can forget them.
 *
 * `isOverdue` is calculated rather than stored: a stored flag would need a
 * scheduled job to flip it and would be wrong between runs. `verifyToken` is
 * never returned raw — only as the URL the QR encodes, and only to people
 * entitled to see it.
 */
export const serializeOutpass = (outpass, { includeQr = false } = {}) => {
  if (!outpass) return outpass;

  const { verifyToken, ...rest } = outpass;

  const isOut = outpass.status === 'ACTIVE';
  const overdueBy = isOut ? Date.now() - new Date(outpass.returnAt).getTime() : 0;
  const isOverdue = isOut && overdueBy > 0;

  return {
    ...rest,
    isOverdue,
    overdueByMinutes: isOverdue ? Math.floor(overdueBy / 60000) : 0,
    // Approved but never used, window closed. The UI greys it out and it no
    // longer counts against the one-open-pass rule.
    isExpired: isExpiredPass(outpass),
    // Only an approved-or-later pass has a token, and only its owner or a
    // reviewer is shown the scannable link.
    qrUrl: includeQr && verifyToken ? `${env.appPublicUrl}/verify/${verifyToken}` : null,
  };
};

const serializeMany = (rows, opts) => rows.map((row) => serializeOutpass(row, opts));

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

/** Arbitrary namespace so these advisory locks cannot collide with any other. */
const OUTPASS_LOCK_NAMESPACE = 4711;

export const createOutpass = async (userId, input) => {
  const created = await prisma.$transaction(async (tx) => {
    // "Do you have an open pass?" then "here is a new one" is a read followed
    // by a write, and two requests can slip between the two — leaving a student
    // with two live passes and two working QR codes. A compare-and-swap cannot
    // help here because there is no row yet to swap on, so take a per-student
    // advisory lock instead: it is held until this transaction ends and blocks
    // only that one student's concurrent creates.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(CAST(${OUTPASS_LOCK_NAMESPACE} AS integer), hashtext(${userId}))`;

    const open = await tx.outpass.findFirst({
      where: openPassFilter(userId),
      select: { reference: true, status: true },
    });

    if (open) {
      throw ApiError.conflict(
        open.status === 'ACTIVE'
          ? `You are currently out on pass ${open.reference}. Check back in before requesting another.`
          : `You already have an open request (${open.reference}). Cancel it before raising a new one.`,
      );
    }

    return tx.outpass.create({
      data: {
        reference: newReference(),
        userId,
        roomNo: input.roomNo,
        destination: input.destination,
        reason: input.reason,
        leaveAt: input.leaveAt,
        returnAt: input.returnAt,
      },
      select: outpassSelect,
    });
  });

  return serializeOutpass(created, { includeQr: true });
};

export const listOwnOutpasses = async (userId, { status, overdue }) => {
  const rows = await prisma.outpass.findMany({
    where: {
      userId,
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(overdue ? { status: 'ACTIVE', returnAt: { lt: new Date() } } : {}),
    },
    select: outpassSelect,
    orderBy: { createdAt: 'desc' },
  });

  return serializeMany(rows, { includeQr: true });
};

export const getOwnOutpass = async (userId, id) => {
  const outpass = await prisma.outpass.findUnique({ where: { id }, select: outpassSelect });

  if (!outpass || outpass.user.id !== userId) throw ApiError.notFound('Outpass not found');

  return serializeOutpass(outpass, { includeQr: true });
};

export const cancelOutpass = async (userId, id) => {
  const outpass = await prisma.outpass.findUnique({ where: { id } });

  if (!outpass || outpass.userId !== userId) throw ApiError.notFound('Outpass not found');

  if (outpass.status === 'ACTIVE') {
    throw ApiError.badRequest(
      'You are already out on this pass — the gate must check you back in.',
    );
  }
  if (!['PENDING', 'APPROVED'].includes(outpass.status)) {
    throw ApiError.badRequest(`This pass was already ${outpass.status.toLowerCase()}`);
  }

  // Retire the token so a screenshot of an approved QR stops working.
  const updated = await transition(id, outpass.status, {
    status: 'CANCELLED',
    verifyToken: null,
    reviewedAt: new Date(),
  });

  if (!updated) {
    throw ApiError.conflict('This pass changed while you were cancelling it — reload and retry');
  }

  return serializeOutpass(updated);
};

// ---------------------------------------------------------------------------
// Warden / admin
// ---------------------------------------------------------------------------

export const listForReview = async ({ status, overdue }) => {
  const rows = await prisma.outpass.findMany({
    where: {
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(overdue ? { status: 'ACTIVE', returnAt: { lt: new Date() } } : {}),
    },
    select: outpassSelect,
    orderBy: [{ status: 'asc' }, { leaveAt: 'asc' }],
  });

  // No `includeQr` here on purpose. A reviewer needs to decide, not to walk
  // students through the gate — and this list covers every student in the
  // hostel, so handing it their live gate tokens is a needless blast radius.
  return serializeMany(rows);
};

export const reviewOutpass = async (reviewerId, id, { decision, note }) => {
  const outpass = await prisma.outpass.findUnique({ where: { id } });

  if (!outpass) throw ApiError.notFound('Outpass not found');
  if (outpass.status !== 'PENDING') {
    throw ApiError.badRequest(`This pass was already ${outpass.status.toLowerCase()}`);
  }
  if (outpass.userId === reviewerId) {
    throw ApiError.forbidden('You cannot review your own outpass');
  }

  // Only from PENDING — two wardens hitting Approve at once must not both
  // review it, and an approve must not overwrite a decision already made.
  const updated = await transition(id, 'PENDING', {
    status: decision,
    reviewerId,
    reviewNote: note ?? null,
    reviewedAt: new Date(),
    // The gate token exists only for an approved pass.
    verifyToken: decision === 'APPROVED' ? newVerifyToken() : null,
  });

  if (!updated) {
    throw ApiError.conflict('Another reviewer just decided this pass — reload the queue');
  }

  // The QR belongs to the student, not the reviewer — they see it on their own
  // page once this returns.
  return serializeOutpass(updated);
};

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

const findByToken = async (token) => {
  const outpass = await prisma.outpass.findUnique({
    where: { verifyToken: token },
    select: outpassSelect,
  });

  if (!outpass) throw ApiError.notFound('This pass code is not valid. Ask the student to refresh.');

  return outpass;
};

const timeOfDay = (date) =>
  new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const fullDateTime = (date) =>
  new Date(date).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * What the guard may do right now, and if nothing, why.
 *
 * This mirrors the checks in `markExit` exactly, so the button the guard is
 * shown is one that will actually succeed — rather than offering "Mark Exit"
 * on a pass the API is about to reject.
 */
const gateAvailability = (outpass) => {
  if (outpass.status === 'ACTIVE') return { nextAction: 'RETURN', blockedReason: null };

  if (outpass.status !== 'APPROVED') {
    return {
      nextAction: null,
      blockedReason: `This pass is ${outpass.status.toLowerCase()} and cannot be used at the gate.`,
    };
  }

  if (new Date(outpass.returnAt) < new Date()) {
    return {
      nextAction: null,
      blockedReason: `This pass expired at ${fullDateTime(outpass.returnAt)} and was never used.`,
    };
  }

  if (Date.now() < new Date(outpass.leaveAt).getTime() - EARLY_EXIT_GRACE_MS) {
    return {
      nextAction: null,
      blockedReason: `Not valid yet — this pass opens at ${fullDateTime(outpass.leaveAt)}.`,
    };
  }

  return { nextAction: 'EXIT', blockedReason: null };
};

export const verifyByToken = async (token) => {
  const outpass = await findByToken(token);

  return {
    outpass: serializeOutpass(outpass),
    ...gateAvailability(outpass),
  };
};

export const markExit = async (guardId, token) => {
  const outpass = await findByToken(token);

  if (outpass.status === 'ACTIVE') {
    throw ApiError.badRequest(
      `${outpass.user.name} was already checked out at ${timeOfDay(outpass.exitedAt)}`,
    );
  }
  if (outpass.status !== 'APPROVED') {
    throw ApiError.badRequest(
      outpass.status === 'COMPLETED'
        ? 'This pass has already been used and closed'
        : `This pass is ${outpass.status.toLowerCase()} — it cannot be used at the gate`,
    );
  }

  // The approved window is the point of the approval — a pass for next Friday
  // must not open the gate today. A short grace lets a student who turns up a
  // few minutes early through.
  if (Date.now() < new Date(outpass.leaveAt).getTime() - EARLY_EXIT_GRACE_MS) {
    throw ApiError.badRequest(
      `This pass is not valid yet — it opens at ${fullDateTime(outpass.leaveAt)}`,
    );
  }

  // An approved pass whose return time has already passed was never used and
  // is dead; it must not be usable at the gate days later.
  if (new Date(outpass.returnAt) < new Date()) {
    throw ApiError.badRequest(
      `This pass expired at ${fullDateTime(outpass.returnAt)} and was never used. The student needs a new one.`,
    );
  }

  // Two guards scanning the same QR at the same moment must log one exit.
  const updated = await transition(outpass.id, 'APPROVED', {
    status: 'ACTIVE',
    exitedAt: new Date(),
    exitLoggedBy: guardId,
  });

  if (!updated) {
    throw ApiError.conflict(
      `${outpass.user.name} was just checked out at another gate — refresh to see the current state`,
    );
  }

  return { outpass: serializeOutpass(updated), nextAction: 'RETURN' };
};

export const markReturn = async (guardId, token) => {
  const outpass = await findByToken(token);

  if (outpass.status === 'COMPLETED') {
    throw ApiError.badRequest(
      `${outpass.user.name} was already checked in at ${timeOfDay(outpass.returnedAt)}`,
    );
  }
  if (outpass.status !== 'ACTIVE') {
    throw ApiError.badRequest(
      outpass.status === 'APPROVED'
        ? 'This student has not been checked out yet — mark the exit first'
        : `This pass is ${outpass.status.toLowerCase()} — it cannot be used at the gate`,
    );
  }

  const updated = await transition(outpass.id, 'ACTIVE', {
    status: 'COMPLETED',
    returnedAt: new Date(),
    returnLoggedBy: guardId,
    // A closed pass must not be re-scannable.
    verifyToken: null,
  });

  if (!updated) {
    throw ApiError.conflict(
      `${outpass.user.name} was just checked in at another gate — refresh to see the current state`,
    );
  }

  // Serialize before the status flips so lateness is still reported.
  const wasLate = new Date() > new Date(outpass.returnAt);

  return {
    outpass: { ...serializeOutpass(updated), returnedLate: wasLate },
    nextAction: null,
  };
};
