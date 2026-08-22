import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './profile.controller.js';
import { REVIEWER_ROLES } from './profile.policy.js';
import {
  updateProfileSchema,
  createChangeRequestSchema,
  reviewChangeRequestSchema,
  listRequestsQuerySchema,
  idParamSchema,
} from './profile.schema.js';

const router = Router();

// Everything here needs a signed-in user.
router.use(requireAuth);

router.get('/', controller.getProfile);
router.patch('/', validate(updateProfileSchema), controller.updateProfile);

// --- Change requests: the user's own ---------------------------------------
router
  .route('/requests')
  .get(validate(listRequestsQuerySchema, 'query'), controller.listMyRequests)
  .post(validate(createChangeRequestSchema), controller.createRequest);

router.patch(
  '/requests/:id/cancel',
  validate(idParamSchema, 'params'),
  controller.cancelRequest,
);

// --- Review queue: wardens and admins only ---------------------------------
router.get(
  '/review/requests',
  requireRole(...REVIEWER_ROLES),
  validate(listRequestsQuerySchema, 'query'),
  controller.listAllRequests,
);

router.patch(
  '/review/requests/:id',
  requireRole(...REVIEWER_ROLES),
  validate(idParamSchema, 'params'),
  validate(reviewChangeRequestSchema),
  controller.reviewRequest,
);

export default router;
