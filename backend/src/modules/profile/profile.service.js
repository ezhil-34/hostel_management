import crypto from 'node:crypto';
import prisma from '../../config/prisma.js';
import ApiError from '../../utils/ApiError.js';
import { publicUserSelect } from '../auth/auth.service.js';
import { FIELD_VALIDATORS } from './profile.schema.js';
import { ACCESS, accessFor, describePolicy, isReviewer, FIELD_META } from './profile.policy.js';

const requestSelect = {
  id: true,
  reference: true,
  field: true,
  oldValue: true,
  newValue: true,
  reason: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  user: { select: { id: true, name: true, rollNumber: true, email: true, role: true } },
  reviewer: { select: { id: true, name: true, role: true } },
};

const newReference = () => `PCR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/** Fields that must stay unique across users. */
const UNIQUE_FIELDS = new Set(['email', 'rollNumber']);

const assertUnique = async (field, value, exceptUserId) => {
  if (!UNIQUE_FIELDS.has(field)) return;
  const clash = await prisma.user.findFirst({
    where: { [field]: value, NOT: { id: exceptUserId } },
    select: { id: true },
  });
  if (clash) {
    throw ApiError.conflict(`Another account already uses that ${FIELD_META[field].label.toLowerCase()}`);
  }
};

/** Runs the same per-field validator the direct-edit path uses. */
const validateFieldValue = (field, value) => {
  const validator = FIELD_VALIDATORS[field];
  if (!validator) throw ApiError.badRequest(`${field} cannot be changed`);

  const result = validator.safeParse(value);
  if (!result.success) {
    throw ApiError.badRequest('Validation failed', [
      { field: 'newValue', message: result.error.issues[0].message },
    ]);
  }
  return result.data;
};

export const getProfile = async (userId, role) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw ApiError.notFound('User not found');

  const [pendingRequests, pendingReviewCount] = await Promise.all([
    prisma.profileChangeRequest.findMany({
      where: { userId, status: 'PENDING' },
      select: requestSelect,
      orderBy: { createdAt: 'desc' },
    }),
    isReviewer(role)
      ? prisma.profileChangeRequest.count({ where: { status: 'PENDING' } })
      : Promise.resolve(0),
  ]);

  return {
    user,
    // The UI renders every input straight from this — no duplicated rules.
    fields: describePolicy(role),
    permissions: {
      canReview: isReviewer(role),
      pendingReviewCount,
    },
    pendingRequests,
  };
};

export const updateOwnProfile = async (userId, role, input) => {
  const submitted = Object.entries(input).filter(([, v]) => v !== undefined);

  if (submitted.length === 0) throw ApiError.badRequest('Provide at least one field to update');

  // Reject the whole payload if any field is off-limits, rather than silently
  // applying the allowed half — a partial success is confusing to debug.
  const blocked = submitted.filter(([field]) => accessFor(role, field) !== ACCESS.SELF);

  if (blocked.length > 0) {
    const needsRequest = blocked.filter(([f]) => accessFor(role, f) === ACCESS.REQUEST);
    throw new ApiError(
      403,
      needsRequest.length > 0
        ? `${needsRequest.map(([f]) => FIELD_META[f].label).join(', ')} can only be changed through an approved request`
        : `${blocked.map(([f]) => FIELD_META[f].label).join(', ')} cannot be changed`,
      blocked.map(([field]) => ({
        field,
        message:
          accessFor(role, field) === ACCESS.REQUEST
            ? 'Raise a change request for this field'
            : 'This field is read-only',
      })),
    );
  }

  for (const [field, value] of submitted) {
    await assertUnique(field, value, userId);
  }

  return prisma.user.update({
    where: { id: userId },
    data: Object.fromEntries(submitted),
    select: publicUserSelect,
  });
};

export const createChangeRequest = async (userId, role, { field, newValue, reason }) => {
  const access = accessFor(role, field);

  if (access === ACCESS.READ_ONLY) {
    throw ApiError.badRequest(`${FIELD_META[field].label} cannot be changed`);
  }
  if (access === ACCESS.SELF) {
    throw ApiError.badRequest(
      `You can change your ${FIELD_META[field].label.toLowerCase()} directly — no request needed`,
    );
  }

  const value = validateFieldValue(field, newValue);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw ApiError.notFound('User not found');

  const oldValue = user[field] ?? null;
  if (String(oldValue ?? '') === String(value)) {
    throw ApiError.badRequest(`Your ${FIELD_META[field].label.toLowerCase()} is already set to that`);
  }

  // One open request per field, so a reviewer never sees two conflicting asks.
  const existing = await prisma.profileChangeRequest.findFirst({
    where: { userId, field, status: 'PENDING' },
    select: { reference: true },
  });
  if (existing) {
    throw ApiError.conflict(
      `You already have a pending request (${existing.reference}) for ${FIELD_META[field].label}`,
    );
  }

  await assertUnique(field, value, userId);

  return prisma.profileChangeRequest.create({
    data: {
      reference: newReference(),
      userId,
      field,
      oldValue: oldValue === null ? null : String(oldValue),
      newValue: String(value),
      reason,
    },
    select: requestSelect,
  });
};

export const listOwnRequests = (userId, status) =>
  prisma.profileChangeRequest.findMany({
    where: { userId, ...(status && status !== 'ALL' ? { status } : {}) },
    select: requestSelect,
    orderBy: { createdAt: 'desc' },
  });

export const cancelOwnRequest = async (userId, requestId) => {
  const request = await prisma.profileChangeRequest.findUnique({ where: { id: requestId } });

  if (!request || request.userId !== userId) throw ApiError.notFound('Request not found');
  if (request.status !== 'PENDING') {
    throw ApiError.badRequest(`This request was already ${request.status.toLowerCase()}`);
  }

  // Compare-and-swap: only cancel if it is *still* pending, so a cancel racing
  // a warden's approval cannot undo a decision that already landed.
  const { count } = await prisma.profileChangeRequest.updateMany({
    where: { id: requestId, status: 'PENDING' },
    data: { status: 'CANCELLED', reviewedAt: new Date() },
  });

  if (count === 0) {
    throw ApiError.conflict('This request was just reviewed — reload to see the outcome');
  }

  return prisma.profileChangeRequest.findUnique({
    where: { id: requestId },
    select: requestSelect,
  });
};

/** Reviewer queue — everyone's requests, newest pending first. */
export const listAllRequests = (status) =>
  prisma.profileChangeRequest.findMany({
    where: status && status !== 'ALL' ? { status } : {},
    select: requestSelect,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

export const reviewRequest = async (reviewerId, requestId, { decision, note }) => {
  const request = await prisma.profileChangeRequest.findUnique({ where: { id: requestId } });

  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== 'PENDING') {
    throw ApiError.badRequest(`This request was already ${request.status.toLowerCase()}`);
  }
  if (request.userId === reviewerId) {
    throw ApiError.forbidden('You cannot review your own request');
  }

  const reviewed = {
    status: decision,
    reviewerId,
    reviewNote: note ?? null,
    reviewedAt: new Date(),
  };

  const alreadyDecided = ApiError.conflict(
    'Another reviewer just decided this request — reload the queue',
  );

  if (decision === 'REJECTED') {
    const { count } = await prisma.profileChangeRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: reviewed,
    });
    if (count === 0) throw alreadyDecided;

    return prisma.profileChangeRequest.findUnique({
      where: { id: requestId },
      select: requestSelect,
    });
  }

  // Re-check uniqueness at approval time: the value may have been taken by
  // someone else in the days since the request was raised.
  await assertUnique(request.field, request.newValue, request.userId);

  // Claim the request and write the value in one transaction. The status guard
  // means two reviewers approving at the same instant produce one write, not
  // two — and throwing inside rolls the whole thing back.
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.profileChangeRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: reviewed,
    });
    if (count === 0) throw alreadyDecided;

    await tx.user.update({
      where: { id: request.userId },
      data: { [request.field]: request.newValue },
    });

    return tx.profileChangeRequest.findUnique({ where: { id: requestId }, select: requestSelect });
  });
};
