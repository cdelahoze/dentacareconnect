import { Router } from 'express';
import {
  getFollowUpQueue,
  triggerControlEngineRun,
} from '../controllers/controlEngine.controller';

const router = Router();

// GET /api/control-engine/queue - Inspect today's generated follow-up queue
router.get('/queue', getFollowUpQueue);

// POST /api/control-engine/run - Manually trigger the daily control engine
router.post('/run', triggerControlEngineRun);

export default router;
