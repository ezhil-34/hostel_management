import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import env from '../../config/env.js';
import validate from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './points.controller.js';
import { ADMIN_ROLES } from './points.service.js';
import {
  setPinSchema,
  changePinSchema,
  payQrSchema,
  createQrSchema,
  topUpSchema,
  listQrQuerySchema,
  listTxQuerySchema,
  idParamSchema,
  tokenParamSchema,
} from './points.schema.js';

const router = Router();

router.use(requireAuth);

// PIN and payment attempts get a tighter budget, same as auth's credential
// endpoints — this is the one place in the module a brute force matters.
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 15 : 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many attempts — try again in 15 minutes' } },
});

// --- Student: wallets, spending history, PIN --------------------------------
router.get('/wallets', controller.wallets);
router.get('/transactions', validate(listTxQuerySchema, 'query'), controller.transactions);

router.get('/pin', controller.pinStatus);
router.post('/pin', pinLimiter, validate(setPinSchema), controller.setPin);
router.patch('/pin', pinLimiter, validate(changePinSchema), controller.changePin);

// --- Student: scan a counter's QR and pay -----------------------------------
// Declared with a distinct prefix so a payment token is never confused with
// an admin QR id below.
router.get('/pay/:token', validate(tokenParamSchema, 'params'), controller.previewPay);
router.post(
  '/pay/:token',
  pinLimiter,
  validate(tokenParamSchema, 'params'),
  validate(payQrSchema),
  controller.pay,
);

// --- Admin / warden: fill points & generate the secret QR -------------------
router.post(
  '/admin/qr',
  requireRole(...ADMIN_ROLES),
  validate(createQrSchema),
  controller.createQr,
);
router.get(
  '/admin/qr',
  requireRole(...ADMIN_ROLES),
  validate(listQrQuerySchema, 'query'),
  controller.listQr,
);
router.patch(
  '/admin/qr/:id/cancel',
  requireRole(...ADMIN_ROLES),
  validate(idParamSchema, 'params'),
  controller.cancelQr,
);

// --- Admin / warden: direct wallet top-up (recharge) ------------------------
router.post(
  '/admin/topup',
  requireRole(...ADMIN_ROLES),
  validate(topUpSchema),
  controller.topUp,
);

export default router;
