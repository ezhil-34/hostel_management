import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import validate from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './auth.controller.js';
import {
  signupSchema,
  signinSchema,
  updateProfileSchema,
  changePasswordSchema,
} from './auth.schema.js';

const router = Router();

// Credential endpoints get a tighter budget than the rest of the API.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many attempts — try again in 15 minutes' } },
});

router.post('/signup', credentialLimiter, validate(signupSchema), controller.signup);
router.post('/signin', credentialLimiter, validate(signinSchema), controller.signin);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);

router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, validate(updateProfileSchema), controller.updateMe);
router.post(
  '/change-password',
  requireAuth,
  credentialLimiter,
  validate(changePasswordSchema),
  controller.changePassword,
);

export default router;
