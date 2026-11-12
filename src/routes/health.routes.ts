import { Router } from 'express';
import { getHealthStatus, getDatabaseHealthStatus } from '../controllers/health.controller';

const router = Router();

// GET /api/health - Basic API connectivity verification
router.get('/', getHealthStatus);

// GET /api/health/db - Database connectivity verification
router.get('/db', getDatabaseHealthStatus);

export default router;
