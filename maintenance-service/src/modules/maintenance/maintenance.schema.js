import { z } from 'zod';

// zod v4 applies `.trim()` after validation, so normalise up front.
const trimmed = (schema) => z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), schema);

const optional = (schema) =>
  z.preprocess(
    (v) => (v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v),
    schema.optional(),
  );

const boolish = (fallback = false) =>
  z
    .preprocess(
      (v) => (v === undefined ? fallback : v === true || v === 'true' || v === '1'),
      z.boolean(),
    )
    .default(fallback);

/** Trades. Kept in sync with `MaintenanceCategory` in schema.prisma. */
export const CATEGORIES = [
  'PLUMBING',
  'ELECTRICAL',
  'CARPENTRY',
  'HOUSEKEEPING',
  'INTERNET',
  'APPLIANCE',
  'PEST_CONTROL',
  'OTHER',
];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const STATUSES = ['OPEN', 'ACCEPTED', 'RESOLVED', 'CLOSED', 'WITHDRAWN'];

export const createRequestSchema = z.object({
  category: z.enum(CATEGORIES, 'Pick what needs fixing'),
  priority: z.enum(PRIORITIES, 'Pick a priority').default('MEDIUM'),
  title: trimmed(z.string().min(5, 'Give it a short title (at least 5 characters)').max(140)),
  description: trimmed(
    z
      .string()
      .min(20, 'Describe the fault in at least 20 characters')
      .max(2000, 'Keep the description under 2000 characters'),
  ),
  /**
   * Optional on the way in: the service falls back to the reporter's own room
   * from their profile, which is the common case.
   */
  roomNo: optional(trimmed(z.string().max(20))),
  locationDetail: optional(trimmed(z.string().max(120))),
});

export const resolveSchema = z.object({
  resolutionNote: trimmed(
    z
      .string()
      .min(10, 'Say what you did to fix it (at least 10 characters)')
      .max(1000, 'Keep the note under 1000 characters'),
  ),
});

export const reopenSchema = z.object({
  reason: trimmed(
    z
      .string()
      .min(10, 'Say what is still wrong (at least 10 characters)')
      .max(1000, 'Keep it under 1000 characters'),
  ),
});

export const commentSchema = z.object({
  body: trimmed(z.string().min(1, 'Write a message').max(2000, 'Keep it under 2000 characters')),
  /**
   * Handler-only note. Accepted from anyone, but the service refuses it from a
   * student — silently downgrading it would be a confusing footgun.
   */
  isInternal: boolish(false),
});

export const reassignSchema = z.object({
  assigneeId: z.uuid('Pick a valid worker'),
  assigneeName: trimmed(z.string().min(2, 'Worker name is required').max(100)),
});

export const listQuerySchema = z.object({
  status: z.enum([...STATUSES, 'ALL']).default('ALL'),
  category: z.enum([...CATEGORIES, 'ALL']).default('ALL'),
});

export const idParamSchema = z.object({
  id: z.uuid('Invalid request id'),
});
