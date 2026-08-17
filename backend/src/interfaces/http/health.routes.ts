import { Router } from 'express';
import type { HealthService } from '../../application/health/health.service';

export function createHealthRouter(healthService: HealthService): Router {
  const router = Router();
  router.get('/health', (_req, res) => {
    res.status(200).json({ data: healthService.getLiveness() });
  });
  router.get('/ready', (_req, res) => {
    const readiness = healthService.getReadiness();
    res.status(readiness.status === 'ready' ? 200 : 503).json({ data: readiness });
  });
  return router;
}
