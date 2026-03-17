import { Router } from 'express';
import authRoutes from './auth.routes.js';
import moduleRoutes from './modules.routes.js';

const router = Router();

router.use(authRoutes);
router.use(moduleRoutes);

export default router;
