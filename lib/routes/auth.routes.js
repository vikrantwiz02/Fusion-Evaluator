import { Router } from 'express';
import { wrap } from '../middleware/asyncHandler.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { login } from '../controllers/auth.controller.js';

const router = Router();

router.post('/auth/google', authRateLimiter, wrap(login));

export default router;
