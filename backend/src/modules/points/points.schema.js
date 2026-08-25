import { z } from 'zod';

// zod v4 applies `.trim()` after validation, so normalise up front.
const trimmed = (schema) => z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), schema);

const optional = (schema) =>
  z.preprocess(
    (v) => (v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v),
    schema.optional(),
  );

export const WALLET_TYPES = ['CANTEEN', 'LAUNDRY'];

/**
 * Exactly four digits, as a string.
 *
 * A string, not a number, because "0042" is a perfectly good PIN and
 * `Number('0042')` is 42. Leading zeros have to survive the trip.
 */
const pin = trimmed(
  z
    .string()
    .regex(/^\d{4}$/, 'Your PIN is exactly four digits'),
);

export const walletTypeParamSchema = z.object({
  type: z.enum(WALLET_TYPES, 'Pick a wallet'),
});

export const setPinSchema = z.object({
  pin,
  confirmPin: pin,
  /**
   * Setting or replacing a PIN needs the account password. Without this a
   * borrowed unlocked phone is enough to set a fresh PIN and drain both
   * wallets — the PIN would protect nothing.
   */
  password: trimmed(z.string().min(1, 'Enter your account password')),
}).refine((v) => v.pin === v.confirmPin, {
  message: 'The two PINs do not match',
  path: ['confirmPin'],
});

export const spendSchema = z.object({
  counterToken: trimmed(z.string().min(8, 'Scan a counter QR code first')),
  itemId: z.uuid('Pick something from the menu'),
  pin,
  /**
   * Sent by the browser and echoed back, never trusted for money. Two taps on
   * Confirm produce the same key, and the second one returns the first
   * receipt instead of charging twice.
   */
  idempotencyKey: optional(trimmed(z.string().max(64))),
});

export const creditSchema = z.object({
  /** Roll number or email — whatever is easier to read off a paper slip. */
  identifier: trimmed(z.string().min(1, 'Enter a roll number or email')),
  type: z.enum(WALLET_TYPES, 'Pick a wallet'),
  points: z
    .number('Enter an amount in points')
    .int('Points come in whole numbers')
    .min(1, 'Credit at least 1 point')
    .max(100000, 'That is more than any hostel account should hold'),
  note: trimmed(
    z
      .string()
      .min(3, 'Say what this is for — it appears on the student’s statement')
      .max(200, 'Keep it under 200 characters'),
  ),
});

export const lookupQuerySchema = z.object({
  q: optional(trimmed(z.string().max(80))),
});

export const historyQuerySchema = z.object({
  type: z.enum([...WALLET_TYPES, 'ALL']).default('ALL'),
  limit: z.preprocess(
    (v) => (v === undefined || v === '' ? 50 : Number(v)),
    z.number().int().min(1).max(200),
  ),
});

export const counterTokenParamSchema = z.object({
  token: trimmed(z.string().min(8, 'That is not a counter code')),
});
