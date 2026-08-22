import { z } from 'zod';

// In zod v4 `.trim()` runs *after* validation, so normalise input up front
// with preprocess — otherwise "  a@b.com  " would be rejected as invalid.
const trimmed = (schema) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), schema);

const lower = (schema) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), schema);

const upper = (schema) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v), schema);

/** Treats "" and null the same as "not provided" — HTML forms send empty strings. */
const optional = (schema) =>
  z.preprocess(
    (v) => (v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v),
    schema.optional(),
  );

const nameField = trimmed(z.string().min(2, 'Name must be at least 2 characters').max(100));

const emailField = lower(z.email('Enter a valid email address'));

const rollField = upper(z.string().min(2, 'Roll number is required').max(30));

const phoneField = trimmed(
  z
    .string()
    .min(7, 'Enter a valid phone number')
    .max(20)
    .regex(/^[+\d][\d\s-]*$/, 'Phone may only contain digits, spaces, + and -'),
);

const shortText = (max, label) => trimmed(z.string().min(1, `${label} is required`).max(max));

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

export const signupSchema = z.object({
  name: nameField,
  email: emailField,
  rollNumber: rollField,
  phone: optional(phoneField),
  password: passwordField,
  roomNo: optional(shortText(20, 'Room number')),
  hostelBlock: optional(shortText(20, 'Hostel block')),
});

export const signinSchema = z.object({
  // Accepts either an email address or a roll number.
  identifier: trimmed(z.string().min(2, 'Enter your email or roll number')),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordField,
});
