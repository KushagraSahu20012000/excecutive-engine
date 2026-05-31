import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Setting } from '../models/Setting.js';
import { broadcastStatsChanged } from '../utils/realtime.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (request, response) => {
  const settings = await Setting.findOneAndUpdate(
    { userId: request.user._id },
    { $setOnInsert: { userId: request.user._id } },
    { upsert: true, new: true }
  );
  response.json({ settings });
});

router.patch('/', async (request, response) => {
  const update = {};
  if ('includeSaturday' in request.body) update.includeSaturday = Boolean(request.body.includeSaturday);
  if ('includeSunday' in request.body) update.includeSunday = Boolean(request.body.includeSunday);
  if ('anchorTaskId' in request.body) update.anchorTaskId = request.body.anchorTaskId || null;

  const settings = await Setting.findOneAndUpdate(
    { userId: request.user._id },
    update,
    { new: true, upsert: true }
  );
  broadcastStatsChanged(request.user._id);
  response.json({ settings });
});

export default router;