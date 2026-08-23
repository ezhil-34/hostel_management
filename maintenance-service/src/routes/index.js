import { Router } from 'express';
import prisma from '../config/prisma.js';
import { pingCoreApi } from '../clients/coreApi.js';
import maintenanceRoutes from '../modules/maintenance/maintenance.routes.js';

const router = Router();

/**
 * Liveness and readiness for this service alone.
 *
 * `coreApi` is reported but deliberately does NOT affect the status code: the
 * maintenance service is healthy when its own database answers. Failing our
 * health check because a *different* service is down would let one outage
 * cascade — which is the failure mode this architecture exists to prevent.
 */
router.get('/health', async (_req, res) => {
  const [database, coreApi] = await Promise.all([
    prisma
      .$queryRaw`SELECT 1`.then(() => 'up')
      .catch(() => 'down'),
    pingCoreApi().then((reachable) => (reachable ? 'up' : 'unreachable')),
  ]);

  res.status(database === 'up' ? 200 : 503).json({
    success: database === 'up',
    data: {
      service: 'maintenance-service',
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      // Informational. Unreachable means new requests are logged without a name
      // snapshot; everything else keeps working.
      coreApi,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/', maintenanceRoutes);

export default router;
