import { Router } from 'express';
import prisma from '../config/prisma.js';
import authRoutes from '../modules/auth/auth.routes.js';
import profileRoutes from '../modules/profile/profile.routes.js';
import outpassRoutes from '../modules/outpass/outpass.routes.js';
import pointsRoutes from '../modules/points/points.routes.js';

const router = Router();

/** Liveness — the process is up. Used by the Docker healthcheck. */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() },
  });
});

/** Readiness — the process is up *and* PostgreSQL answers. */
router.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, data: { database: 'up' } });
  } catch (err) {
    res.status(503).json({ success: false, error: { message: 'Database unreachable', details: err.message } });
  }
});

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/outpasses', outpassRoutes);
router.use('/points', pointsRoutes);

// Feature routers land here as they are built:
// router.use('/maintenance', maintenanceRoutes);

export default router;
