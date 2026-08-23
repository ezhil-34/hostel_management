import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import withDisplayName from '../../middleware/displayName.js';
import * as controller from './maintenance.controller.js';
import { WORKER_ROLES, OVERSIGHT_ROLES } from './maintenance.service.js';
import {
  createRequestSchema,
  resolveSchema,
  reopenSchema,
  commentSchema,
  reassignSchema,
  listQuerySchema,
  idParamSchema,
} from './maintenance.schema.js';

const router = Router();

router.use(requireAuth);

// --- Worker queue -----------------------------------------------------------
// Declared before `/:id` so "queue" is never parsed as a request id.
router.get(
  '/queue',
  requireRole(...WORKER_ROLES, ...OVERSIGHT_ROLES),
  validate(listQuerySchema, 'query'),
  controller.queue,
);

// --- Warden / admin oversight ----------------------------------------------
router.get(
  '/admin',
  requireRole(...OVERSIGHT_ROLES),
  validate(listQuerySchema, 'query'),
  controller.listAll,
);

// --- The student's own requests ------------------------------------------
router
  .route('/')
  .get(validate(listQuerySchema, 'query'), controller.listMine)
  .post(withDisplayName, validate(createRequestSchema), controller.create);

router.get('/:id', validate(idParamSchema, 'params'), controller.getOne);

router.patch('/:id/withdraw', validate(idParamSchema, 'params'), controller.withdraw);

router.post(
  '/:id/reopen',
  validate(idParamSchema, 'params'),
  validate(reopenSchema),
  controller.reopen,
);

router.post('/:id/close', validate(idParamSchema, 'params'), controller.close);

router.post(
  '/:id/comments',
  withDisplayName,
  validate(idParamSchema, 'params'),
  validate(commentSchema),
  controller.comment,
);

// --- Worker actions ---------------------------------------------------------
router.post(
  '/:id/accept',
  requireRole(...WORKER_ROLES),
  withDisplayName,
  validate(idParamSchema, 'params'),
  controller.accept,
);

router.post(
  '/:id/resolve',
  requireRole(...WORKER_ROLES, ...OVERSIGHT_ROLES),
  withDisplayName,
  validate(idParamSchema, 'params'),
  validate(resolveSchema),
  controller.resolve,
);

router.post(
  '/:id/reassign',
  requireRole(...OVERSIGHT_ROLES),
  withDisplayName,
  validate(idParamSchema, 'params'),
  validate(reassignSchema),
  controller.reassign,
);

export default router;
