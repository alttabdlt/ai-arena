import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router: Router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    service: 'metaverse-backend',
    checks: {
      database: 'pending',
      convex: 'pending',
      redis: 'pending'
    }
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    healthcheck.checks.database = 'healthy';
  } catch (error) {
    healthcheck.checks.database = 'unhealthy';
    healthcheck.message = 'Database connection failed';
  }

  // TODO: Add Convex health check
  healthcheck.checks.convex = 'not_implemented';

  // TODO: Add Redis health check
  healthcheck.checks.redis = 'not_implemented';

  const status = Object.values(healthcheck.checks).includes('unhealthy') ? 503 : 200;
  res.status(status).json(healthcheck);
});

router.get('/ready', async (req, res) => {
  try {
    // Check if all services are ready
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/live', (req, res) => {
  res.status(200).json({ alive: true });
});

export default router;