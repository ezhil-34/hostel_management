import { z } from 'zod';

// zod v4 applies `.trim()` after validation, so normalise up front — same
// convention as auth.schema.js / outpass.schema.js.
const trimmed = (schema) => z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), schema);

const upper = (schema) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v), schema);

/** Treats "" and null the same as "not provided". */
const optional = (schema) =>
  z.preprocess(
    (v) => (v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v),
    schema.optional(),
  );

export const WALLET_TYPES = ['CANTEEN', 'LAUNDRY'];

const pinField = z
  .string()
  .regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits');

const amountField = z.coerce
  .number('Amount is required')
  .int('Amount must be a whole number')
  .positive('Amount must be greater than 0')
  .max(100000, 'Amount is too large');

export const setPinSchema = z
  .object({
    pin: pinField,
    confirmPin: pinField,
  })
  .refine((d) => d.pin === d.confirmPin, { path: ['confirmPin'], error: 'PINs do not match' });

export const changePinSchema = z
  .object({
    currentPin: z.string().min(1, 'Current PIN is required'),
    newPin: pinField,
    confirmNewPin: pinField,
  })
  .refine((d) => d.newPin === d.confirmNewPin, {
    path: ['confirmNewPin'],
    error: 'PINs do not match',
  })
  .refine((d) => d.currentPin !== d.newPin, {
    path: ['newPin'],
    error: 'New PIN must be different from the current PIN',
  });

export const payQrSchema = z.object({
  pin: z.string().min(1, 'PIN is required'),
});

export const createQrSchema = z.object({
  walletType: z.enum(WALLET_TYPES, `walletType must be ${WALLET_TYPES.join(' or ')}`),
  amount: amountField,
  title: optional(trimmed(z.string().max(120, 'Keep the title under 120 characters'))),
});

export const topUpSchema = z.object({
  rollNumber: upper(z.string().min(2, 'Roll number is required').max(30)),
  walletType: z.enum(WALLET_TYPES, `walletType must be ${WALLET_TYPES.join(' or ')}`),
  amount: amountField,
  note: optional(trimmed(z.string().max(200, 'Keep the note under 200 characters'))),
});

export const listQrQuerySchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'ALL']).default('ALL'),
});

export const listTxQuerySchema = z.object({
  walletType: z.enum([...WALLET_TYPES, 'ALL']).default('ALL'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const idParamSchema = z.object({
  id: z.uuid('Invalid id'),
});

export const tokenParamSchema = z.object({
  token: trimmed(z.string().min(20, 'Invalid payment code').max(200)),
});
