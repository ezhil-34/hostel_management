import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './outpass.controller.js';
import { REVIEWER_ROLES, GATE_ROLES } from './outpass.service.js';
import {
  createOutpassSchema,
  reviewOutpassSchema,
  listQuerySchema,
  idParamSchema,
  tokenParamSchema,
} from './outpass.schema.js';

const router = Router();

router.use(requireAuth);

// --- Gate --------------------------------------------------------------------
// Declared before `/:id` so "verify" is never swallowed as an outpass id.
// Every gate route is guarded: the QR token alone must never be enough, or a
// photo of someone's pass would be a working key.
router.get(
  '/verify/:token',
  requireRole(...GATE_ROLES),
  validate(tokenParamSchema, 'params'),
  controller.verify,
);
router.post(
  '/verify/:token/exit',
  requireRole(...GATE_ROLES),
  validate(tokenParamSchema, 'params'),
  controller.markExit,
);
router.post(
  '/verify/:token/return',
  requireRole(...GATE_ROLES),
  validate(tokenParamSchema, 'params'),
  controller.markReturn,
);

// --- Warden / admin review ---------------------------------------------------
router.get(
  '/review',
  requireRole(...REVIEWER_ROLES),
  validate(listQuerySchema, 'query'),
  controller.listForReview,
);
router.patch(
  '/review/:id',
  requireRole(...REVIEWER_ROLES),
  validate(idParamSchema, 'params'),
  validate(reviewOutpassSchema),
  controller.review,
);

// --- The student's own passes -----------------------------------------------
router
  .route('/')
  .get(validate(listQuerySchema, 'query'), controller.listMine)
  .post(validate(createOutpassSchema), controller.create);

router.get('/:id', validate(idParamSchema, 'params'), controller.getOne);
router.patch('/:id/cancel', validate(idParamSchema, 'params'), controller.cancel);

export default router;
