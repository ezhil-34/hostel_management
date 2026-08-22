import { z } from 'zod';
import { PROFILE_FIELDS } from './profile.policy.js';

const trimmed = (schema) => z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), schema);

const optional = (schema) =>
  z.preprocess(
    (v) => (v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v),
    schema.optional(),
  );

/**
 * Per-field rules, reused for both direct edits and change requests so a value
 * that would be rejected on PATCH cannot sneak in through the ticket flow.
 */
export const FIELD_VALIDATORS = {
  name: trimmed(z.string().min(2, 'Name must be at least 2 characters').max(100)),
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.email('Enter a valid email address'),
  ),
  rollNumber: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
    z.string().min(2, 'Roll number is required').max(30),
  ),
  phone: trimmed(
    z
      .string()
      .min(7, 'Enter a valid phone number')
      .max(20)
      .regex(/^[+\d][\d\s-]*$/, 'Phone may only contain digits, spaces, + and -'),
  ),
  roomNo: trimmed(z.string().min(1, 'Room number is required').max(20)),
  hostelBlock: trimmed(z.string().min(1, 'Hostel block is required').max(20)),
};

/** PATCH /api/profile — every field optional; the policy decides what is allowed. */
export const updateProfileSchema = z
  .object(
    Object.fromEntries(
      Object.entries(FIELD_VALIDATORS).map(([field, validator]) => [field, optional(validator)]),
    ),
  )
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    'Provide at least one field to update',
  );

/** POST /api/profile/requests */
export const createChangeRequestSchema = z.object({
  field: z.enum(PROFILE_FIELDS, 'Unknown profile field'),
  newValue: trimmed(z.string().min(1, 'Enter the value you are requesting')),
  reason: trimmed(
    z
      .string()
      .min(10, 'Explain why this change is needed (at least 10 characters)')
      .max(500, 'Keep the reason under 500 characters'),
  ),
});

/** PATCH /api/profile/requests/:id/review */
export const reviewChangeRequestSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], 'Decision must be APPROVED or REJECTED'),
  note: optional(trimmed(z.string().max(500, 'Keep the note under 500 characters'))),
});

export const listRequestsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL']).default('ALL'),
});

export const idParamSchema = z.object({
  id: z.uuid('Invalid request id'),
});
