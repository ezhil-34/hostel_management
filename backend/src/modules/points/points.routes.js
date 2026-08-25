import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import validate from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './points.controller.js';
import { OVERSIGHT_ROLES } from './points.service.js';
import {
  setPinSchema,
  spendSchema,
  creditSchema,
  lookupQuerySchema,
  historyQuerySchema,
  counterTokenParamSchema,
} from './points.schema.js';

const router = Router();

/**
 * A tighter limit on the two routes that take a PIN.
 *
 * The per-wallet lockout in the service is the real defence; this sits in front
 * of it so an attacker cannot spray one guess each across many accounts without
 * ever tripping a single wallet's counter.
 */
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many PIN attempts from this device. Try again in a few minutes.' },
  },
});

router.use(requireAuth);

// --- The student's own wallets ---------------------------------------------
router.get('/wallets', controller.wallets);
router.get('/transactions', validate(historyQuerySchema, 'query'), controller.history);

// --- Counters ---------------------------------------------------------------
// Listed before the token route so "counters" is never read as a token.
router.get('/counters', controller.counters);
router.get(
  '/counters/:token',
  validate(counterTokenParamSchema, 'params'),
  controller.counterByToken,
);

// --- Spending ---------------------------------------------------------------
router.post('/pin', pinLimiter, validate(setPinSchema), controller.setPin);
router.post('/spend', pinLimiter, validate(spendSchema), controller.spend);

// --- Warden / admin ---------------------------------------------------------
router.get(
  '/students',
  requireRole(...OVERSIGHT_ROLES),
  validate(lookupQuerySchema, 'query'),
  controller.lookup,
);
router.post(
  '/credit',
  requireRole(...OVERSIGHT_ROLES),
  validate(creditSchema),
  controller.credit,
);

export default router;
