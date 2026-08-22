import { z } from 'zod';

// zod v4 applies `.trim()` after validation, so normalise up front.
const trimmed = (schema) => z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), schema);

const optional = (schema) =>
  z.preprocess(
    (v) => (v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v),
    schema.optional(),
  );

/** Accepts an ISO string or anything `new Date()` understands; yields a Date. */
const dateField = (label) =>
  z.preprocess(
    (v) => {
      if (v instanceof Date) return v;
      if (typeof v !== 'string' || v.trim() === '') return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? v : d;
    },
    z.date({ error: `Enter a valid ${label}` }),
  );

export const createOutpassSchema = z
  .object({
    destination: trimmed(
      z.string().min(3, 'Where are you going? (at least 3 characters)').max(120),
    ),
    reason: trimmed(
      z
        .string()
        .min(10, 'Give a reason of at least 10 characters')
        .max(500, 'Keep the reason under 500 characters'),
    ),
    roomNo: trimmed(z.string().min(1, 'Room number is required').max(20)),
    leaveAt: dateField('leave time'),
    returnAt: dateField('return time'),
  })
  .refine((d) => d.returnAt > d.leaveAt, {
    path: ['returnAt'],
    error: 'Return time must be after the leave time',
  })
  // 5 minutes of slack so a clock skew between browser and server does not
  // reject a pass the student just filled in for "now".
  .refine((d) => d.leaveAt.getTime() > Date.now() - 5 * 60 * 1000, {
    path: ['leaveAt'],
    error: 'Leave time cannot be in the past',
  });

export const reviewOutpassSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], 'Decision must be APPROVED or REJECTED'),
  note: optional(trimmed(z.string().max(500, 'Keep the note under 500 characters'))),
});

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

export const listQuerySchema = z
  .object({
    status: z.enum([...STATUSES, 'ALL']).default('ALL'),
    // Query strings are always text — accept "true"/"1" as true.
    overdue: z
      .preprocess(
        (v) => (v === undefined ? false : v === true || v === 'true' || v === '1'),
        z.boolean(),
      )
      .default(false),
  })
  // `overdue` implies ACTIVE. Pairing it with any other status used to silently
  // win, quietly returning something the caller did not ask for — say so instead.
  .refine((q) => !q.overdue || q.status === 'ALL' || q.status === 'ACTIVE', {
    path: ['status'],
    error: 'overdue=true only applies to ACTIVE passes — drop the status filter or use status=ACTIVE',
  });

export const idParamSchema = z.object({
  id: z.uuid('Invalid outpass id'),
});

export const tokenParamSchema = z.object({
  token: trimmed(z.string().min(20, 'Invalid pass code').max(200)),
});
