import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Deadline } from '../models/Deadline.js';
import { broadcastStatsChanged } from '../utils/realtime.js';

const router = express.Router();
router.use(requireAuth);

async function failOverdueDeadlines(userId) {
  await Deadline.updateMany(
    { userId, outcome: 'pending', dueAt: { $lt: new Date() } },
    { outcome: 'fail' }
  );
}

router.get('/', async (request, response) => {
  await failOverdueDeadlines(request.user._id);
  const deadlines = await Deadline.find({ userId: request.user._id }).sort({ dueAt: 1 });
  response.json({ deadlines });
});

router.post('/', async (request, response) => {
  const deadline = await Deadline.create({
    userId: request.user._id,
    title: request.body.title,
    description: request.body.description || '',
    dueAt: request.body.dueAt
  });
  broadcastStatsChanged(request.user._id);
  response.status(201).json({ deadline });
});

router.patch('/:deadlineId', async (request, response) => {
  const nextOutcome = request.body.outcome;
  const deadline = await Deadline.findOneAndUpdate(
    { _id: request.params.deadlineId, userId: request.user._id },
    {
      title: request.body.title,
      description: request.body.description || '',
      dueAt: request.body.dueAt,
      outcome: nextOutcome,
      passedAt: nextOutcome === 'pass' ? new Date() : null
    },
    { new: true }
  );
  broadcastStatsChanged(request.user._id);
  response.json({ deadline });
});

router.delete('/:deadlineId', async (request, response) => {
  await Deadline.deleteOne({ _id: request.params.deadlineId, userId: request.user._id });
  broadcastStatsChanged(request.user._id);
  response.json({ ok: true });
});

export default router;