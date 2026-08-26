import crypto from 'node:crypto';
import prisma from '../../config/prisma.js';
import ApiError from '../../utils/ApiError.js';
import { fetchUserSnapshot } from '../../clients/coreApi.js';

/** Roles that work the queue. Read off the JWT, not a local table. */
export const WORKER_ROLES = ['MAINTENANCE_WORKER'];
export const OVERSIGHT_ROLES = ['WARDEN', 'ADMIN'];
export const HANDLER_ROLES = [...WORKER_ROLES, ...OVERSIGHT_ROLES];

const isHandler = (role) => HANDLER_ROLES.includes(role);
const isOversight = (role) => OVERSIGHT_ROLES.includes(role);

const newReference = () => `MNT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const requestSelect = {
  id: true,
  reference: true,
  studentId: true,
  reporterName: true,
  reporterRollNumber: true,
  reporterPhone: true,
  roomNo: true,
  locationDetail: true,
  category: true,
  priority: true,
  title: true,
  description: true,
  status: true,
  assigneeId: true,
  assigneeName: true,
  acceptedAt: true,
  resolutionNote: true,
  resolvedAt: true,
  closedAt: true,
  reopenCount: true,
  lastStudentViewAt: true,
  createdAt: true,
  updatedAt: true,
};

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Shapes a request for one specific viewer.
 *
 * `studentId` is stripped for everyone — it exists so a student can find their
 * own requests, and no client needs it. Everything a handler is shown comes from
 * the snapshot columns instead.
 */
export const serializeRequest = (request, viewer) => {
  if (!request) return request;

  /**
   * `assigneeId` goes out with the others. It is a core-API user uuid, it is
   * used only server-side (for `canResolve` and the worker's queue filter), and
   * nothing in the UI reads it — so handing a student a stable identifier for a
   * staff account was pure leak. The worker's *name* is what the student needs.
   */
  const { studentId, assigneeId, lastStudentViewAt, ...rest } = request;
  const isOwner = viewer.id === studentId;

  const statusChangedAt =
    request.closedAt ?? request.resolvedAt ?? request.acceptedAt ?? request.createdAt;

  return {
    ...rest,
    isOwner,
    // Only the person who reported it needs the update badge.
    hasUnreadUpdate: isOwner
      ? !lastStudentViewAt || new Date(statusChangedAt) > new Date(lastStudentViewAt)
      : false,
    canAccept: request.status === 'OPEN' && WORKER_ROLES.includes(viewer.role),
    canResolve: request.status === 'ACCEPTED' && request.assigneeId === viewer.id,
    canReopen: request.status === 'RESOLVED' && isOwner,
    canClose: request.status === 'RESOLVED' && isOwner,
    canWithdraw: request.status === 'OPEN' && isOwner,
  };
};

const serializeMany = (rows, viewer) => rows.map((row) => serializeRequest(row, viewer));

/**
 * Timeline entries, with `actorId` dropped.
 *
 * Nothing in the UI needs an actor's uuid, and returning raw rows is how
 * identifiers leak into places nobody audited. Everything leaving this service
 * goes through a serializer.
 */
const serializeEvent = (event) => ({
  id: event.id,
  type: event.type,
  actorName: event.actorName,
  note: event.note,
  createdAt: event.createdAt,
});

const serializeComment = (comment, viewer) => ({
  id: comment.id,
  body: comment.body,
  isInternal: comment.isInternal,
  createdAt: comment.createdAt,
  authorRole: comment.authorRole,
  authorName: comment.authorName,
  isMine: comment.authorId === viewer.id,
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Applies a status change only if the row is still in the status we checked.
 *
 * Two workers tapping Accept on the same job is the headline race here. Putting
 * the expected status in the WHERE clause makes the decision and the write one
 * atomic statement — exactly one wins. Returns null for the loser.
 */
const transition = async (id, fromStatus, data) => {
  const { count } = await prisma.maintenanceRequest.updateMany({
    where: { id, status: fromStatus },
    data,
  });

  if (count === 0) return null;

  return prisma.maintenanceRequest.findUnique({ where: { id }, select: requestSelect });
};

const recordEvent = (requestId, type, actor, note = null) =>
  prisma.maintenanceEvent.create({
    data: { requestId, type, actorId: actor.id, actorName: actor.name, note },
  });

const nameOf = (viewer) => viewer.displayName ?? viewer.role.replace('_', ' ').toLowerCase();

const loadOr404 = async (id) => {
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id },
    select: requestSelect,
  });
  if (!request) throw ApiError.notFound('Maintenance request not found');
  return request;
};

/** Owner or handler. Anyone else gets a 404, not a 403 — no existence leak. */
const assertCanView = (request, viewer) => {
  if (request.studentId === viewer.id) return;
  if (isHandler(viewer.role)) return;
  throw ApiError.notFound('Maintenance request not found');
};

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

export const createRequest = async (viewer, accessToken, input) => {
  // A worker has to know whose room to enter and who to call, so the reporter
  // is always identified. The name is taken from the core API rather than the
  // browser: trusting the client would let a student report under another's.
  const snapshot = await fetchUserSnapshot(accessToken);

  const roomNo = input.roomNo ?? snapshot?.roomNo ?? null;
  if (!roomNo) {
    throw ApiError.badRequest(
      'We could not work out which room this is for — enter the room number.',
    );
  }

  const request = await prisma.maintenanceRequest.create({
    data: {
      reference: newReference(),
      studentId: viewer.id,
      reporterName: snapshot?.name ?? 'Unknown',
      reporterRollNumber: snapshot?.rollNumber ?? null,
      reporterPhone: snapshot?.phone ?? null,
      roomNo,
      locationDetail: input.locationDetail ?? null,
      category: input.category,
      priority: input.priority,
      title: input.title,
      description: input.description,
    },
    select: requestSelect,
  });

  await recordEvent(request.id, 'REPORTED', { id: viewer.id, name: request.reporterName });

  return {
    request: serializeRequest(request, viewer),
    // Surfaced so the UI can say the details are missing rather than silently
    // showing "Unknown" when the core API was unreachable.
    snapshotUnavailable: snapshot === null,
  };
};

export const listOwnRequests = async (viewer, { status, category }) => {
  const rows = await prisma.maintenanceRequest.findMany({
    where: {
      studentId: viewer.id,
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(category && category !== 'ALL' ? { category } : {}),
    },
    select: requestSelect,
    orderBy: { createdAt: 'desc' },
  });

  return serializeMany(rows, viewer);
};

export const getRequest = async (viewer, id) => {
  const request = await loadOr404(id);
  assertCanView(request, viewer);

  const isOwner = request.studentId === viewer.id;

  const [comments, events] = await Promise.all([
    prisma.maintenanceComment.findMany({
      where: {
        requestId: id,
        // Internal notes are filtered in the query, not after — a student's
        // response is never built from rows they should not have.
        ...(isHandler(viewer.role) && !isOwner ? {} : { isInternal: false }),
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.maintenanceEvent.findMany({ where: { requestId: id }, orderBy: { createdAt: 'asc' } }),
  ]);

  // Viewing marks it read, which is what clears the update badge.
  if (isOwner) {
    await prisma.maintenanceRequest.updateMany({
      where: { id },
      data: { lastStudentViewAt: new Date() },
    });
  }

  return {
    request: serializeRequest(request, viewer),
    comments: comments.map((c) => serializeComment(c, viewer)),
    events: events.map(serializeEvent),
  };
};

export const withdrawRequest = async (viewer, id) => {
  const request = await loadOr404(id);
  if (request.studentId !== viewer.id) throw ApiError.notFound('Maintenance request not found');

  if (request.status !== 'OPEN') {
    throw ApiError.badRequest(
      request.status === 'ACCEPTED'
        ? 'A worker is already on this — leave a message instead of withdrawing it'
        : `This request was already ${request.status.toLowerCase()}`,
    );
  }

  /**
   * Stamping the view time in the same write is what stops a student's own
   * action lighting up their own "Update" badge. The badge means "something
   * happened while you were not looking"; clicking the button yourself is the
   * clearest possible case of looking.
   */
  const updated = await transition(id, 'OPEN', {
    status: 'WITHDRAWN',
    closedAt: new Date(),
    lastStudentViewAt: new Date(),
  });
  if (!updated) throw ApiError.conflict('This request changed while you were withdrawing it');

  await recordEvent(id, 'WITHDRAWN', { id: viewer.id, name: request.reporterName });
  return serializeRequest(updated, viewer);
};

export const reopenRequest = async (viewer, id, { reason }) => {
  const request = await loadOr404(id);
  if (request.studentId !== viewer.id) throw ApiError.notFound('Maintenance request not found');

  if (request.status !== 'RESOLVED') {
    throw ApiError.badRequest(
      `Only a resolved request can be reopened — this one is ${request.status.toLowerCase()}`,
    );
  }

  // Back to the same worker: they know the history, and it stops a reopened job
  // falling back into the unassigned pool.
  const updated = await transition(id, 'RESOLVED', {
    status: 'ACCEPTED',
    resolutionNote: null,
    resolvedAt: null,
    reopenCount: { increment: 1 },
    // The student just did this themselves — see closeRequest.
    lastStudentViewAt: new Date(),
  });
  if (!updated) throw ApiError.conflict('This request changed while you were reopening it');

  await recordEvent(id, 'REOPENED', { id: viewer.id, name: request.reporterName }, reason);
  return serializeRequest(updated, viewer);
};

export const closeRequest = async (viewer, id) => {
  const request = await loadOr404(id);
  if (request.studentId !== viewer.id) throw ApiError.notFound('Maintenance request not found');

  if (request.status !== 'RESOLVED') {
    throw ApiError.badRequest(
      `Only a resolved request can be closed — this one is ${request.status.toLowerCase()}`,
    );
  }

  /**
   * Stamping the view time in the same write is what stops a student's own
   * action lighting up their own "Update" badge. The badge means "something
   * happened while you were not looking"; clicking the button yourself is the
   * clearest possible case of looking.
   */
  const updated = await transition(id, 'RESOLVED', {
    status: 'CLOSED',
    closedAt: new Date(),
    lastStudentViewAt: new Date(),
  });
  if (!updated) throw ApiError.conflict('This request changed while you were closing it');

  await recordEvent(id, 'CLOSED', { id: viewer.id, name: request.reporterName });
  return serializeRequest(updated, viewer);
};

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export const addComment = async (viewer, id, { body, isInternal }) => {
  const request = await loadOr404(id);
  assertCanView(request, viewer);

  const isOwner = request.studentId === viewer.id;

  if (isInternal && !isHandler(viewer.role)) {
    throw ApiError.forbidden('Only handlers can leave internal notes');
  }
  if (isInternal && isOwner) {
    throw ApiError.badRequest('An internal note on your own request would be pointless');
  }
  if (['CLOSED', 'WITHDRAWN'].includes(request.status)) {
    throw ApiError.badRequest(`This request is ${request.status.toLowerCase()}`);
  }

  const authorName = isOwner ? request.reporterName : nameOf(viewer);

  const comment = await prisma.maintenanceComment.create({
    data: {
      requestId: id,
      authorId: viewer.id,
      authorRole: viewer.role,
      authorName,
      body,
      isInternal: Boolean(isInternal),
    },
  });

  if (!isInternal) await recordEvent(id, 'COMMENTED', { id: viewer.id, name: authorName });

  return serializeComment(comment, viewer);
};

// ---------------------------------------------------------------------------
// Maintenance worker
// ---------------------------------------------------------------------------

export const listQueue = async (viewer, { status, category }) => {
  const rows = await prisma.maintenanceRequest.findMany({
    where: {
      // The unclaimed pool, plus whatever this worker already owns.
      OR: [{ status: 'OPEN' }, { assigneeId: viewer.id }],
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(category && category !== 'ALL' ? { category } : {}),
    },
    select: requestSelect,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  return serializeMany(rows, viewer);
};

export const acceptRequest = async (viewer, id) => {
  const request = await loadOr404(id);

  if (request.status !== 'OPEN') {
    throw ApiError.conflict(
      request.assigneeName
        ? `${request.assigneeName} already picked this up`
        : `This request is already ${request.status.toLowerCase()}`,
    );
  }

  const updated = await transition(id, 'OPEN', {
    status: 'ACCEPTED',
    assigneeId: viewer.id,
    assigneeName: viewer.displayName ?? 'Maintenance worker',
    acceptedAt: new Date(),
  });

  if (!updated) {
    throw ApiError.conflict('Another worker just picked this up — refresh the queue');
  }

  await recordEvent(id, 'ACCEPTED', { id: viewer.id, name: updated.assigneeName });
  return serializeRequest(updated, viewer);
};

export const resolveRequest = async (viewer, id, { resolutionNote }) => {
  const request = await loadOr404(id);

  if (request.status !== 'ACCEPTED') {
    throw ApiError.badRequest(
      `Only a job you have accepted can be resolved — this one is ${request.status.toLowerCase()}`,
    );
  }
  // Oversight roles can resolve anything; a worker only their own work.
  if (!isOversight(viewer.role) && request.assigneeId !== viewer.id) {
    throw ApiError.forbidden(`${request.assigneeName ?? 'Another worker'} owns this job`);
  }

  const updated = await transition(id, 'ACCEPTED', {
    status: 'RESOLVED',
    resolutionNote,
    resolvedAt: new Date(),
  });
  if (!updated) throw ApiError.conflict('This request changed while you were resolving it');

  await recordEvent(id, 'RESOLVED', { id: viewer.id, name: nameOf(viewer) }, resolutionNote);
  return serializeRequest(updated, viewer);
};

// ---------------------------------------------------------------------------
// Warden / admin oversight
// ---------------------------------------------------------------------------

export const listAll = async (viewer, { status, category }) => {
  const rows = await prisma.maintenanceRequest.findMany({
    where: {
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(category && category !== 'ALL' ? { category } : {}),
    },
    select: requestSelect,
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
  });

  return serializeMany(rows, viewer);
};

export const reassignRequest = async (viewer, id, { assigneeId, assigneeName }) => {
  const request = await loadOr404(id);

  if (!['OPEN', 'ACCEPTED'].includes(request.status)) {
    throw ApiError.badRequest(`This request is ${request.status.toLowerCase()}`);
  }

  const updated = await transition(id, request.status, {
    status: 'ACCEPTED',
    assigneeId,
    assigneeName,
    acceptedAt: request.acceptedAt ?? new Date(),
  });
  if (!updated) throw ApiError.conflict('This request changed while you were reassigning it');

  await recordEvent(id, 'REASSIGNED', { id: viewer.id, name: nameOf(viewer) }, `Assigned to ${assigneeName}`);
  return serializeRequest(updated, viewer);
};

export const stats = async () => {
  const grouped = await prisma.maintenanceRequest.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
};
