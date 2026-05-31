import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Goal } from '../models/Goal.js';
import { GoalAction } from '../models/GoalAction.js';
import { GoalActionCompletion } from '../models/GoalActionCompletion.js';
import { GoalNote } from '../models/GoalNote.js';
import { localDateKey } from '../utils/dates.js';

const router = express.Router();
router.use(requireAuth);

async function goalPayload(userId) {
  const goals = await Goal.find({ userId }).sort({ deadlineAt: 1 });
  const goalIds = goals.map((goal) => goal._id);
  const historyStart = localDateKey(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  const [actions, notes, completions] = await Promise.all([
    GoalAction.find({ userId, goalId: { $in: goalIds } }).sort({ createdAt: 1 }),
    GoalNote.find({ userId, goalId: { $in: goalIds } }).sort({ createdAt: -1 }),
    GoalActionCompletion.find({ userId, goalId: { $in: goalIds }, date: { $gte: historyStart } }).sort({ date: 1 })
  ]);

  return goals.map((goal) => ({
    ...goal.toObject(),
    actions: actions.filter((action) => String(action.goalId) === String(goal._id)),
    notes: notes.filter((note) => String(note.goalId) === String(goal._id)),
    completions: completions.filter((completion) => String(completion.goalId) === String(goal._id))
  }));
}

router.get('/', async (request, response) => {
  response.json({ goals: await goalPayload(request.user._id) });
});

router.post('/', async (request, response) => {
  const goal = await Goal.create({
    userId: request.user._id,
    title: request.body.title,
    description: request.body.description || '',
    deadlineAt: request.body.deadlineAt
  });
  response.status(201).json({ goal });
});

router.patch('/:goalId', async (request, response) => {
  const goal = await Goal.findOneAndUpdate(
    { _id: request.params.goalId, userId: request.user._id },
    {
      title: request.body.title,
      description: request.body.description || '',
      deadlineAt: request.body.deadlineAt
    },
    { new: true }
  );
  response.json({ goal });
});

router.delete('/:goalId', async (request, response) => {
  const filter = { goalId: request.params.goalId, userId: request.user._id };
  await Promise.all([
    Goal.deleteOne({ _id: request.params.goalId, userId: request.user._id }),
    GoalAction.deleteMany(filter),
    GoalNote.deleteMany(filter),
    GoalActionCompletion.deleteMany(filter)
  ]);
  response.json({ ok: true });
});

router.post('/:goalId/actions', async (request, response) => {
  const action = await GoalAction.create({
    userId: request.user._id,
    goalId: request.params.goalId,
    title: request.body.title
  });
  response.status(201).json({ action });
});

router.delete('/:goalId/actions/:actionId', async (request, response) => {
  await Promise.all([
    GoalAction.deleteOne({ _id: request.params.actionId, goalId: request.params.goalId, userId: request.user._id }),
    GoalActionCompletion.deleteMany({ actionId: request.params.actionId, userId: request.user._id })
  ]);
  response.json({ ok: true });
});

router.post('/:goalId/actions/:actionId/toggle', async (request, response) => {
  const date = request.body.date || localDateKey();
  const existing = await GoalActionCompletion.findOne({
    userId: request.user._id,
    actionId: request.params.actionId,
    date
  });

  if (existing) {
    await existing.deleteOne();
    return response.json({ completed: false });
  }

  await GoalActionCompletion.create({
    userId: request.user._id,
    goalId: request.params.goalId,
    actionId: request.params.actionId,
    date
  });
  response.json({ completed: true });
});

router.post('/:goalId/notes', async (request, response) => {
  const note = await GoalNote.create({
    userId: request.user._id,
    goalId: request.params.goalId,
    kind: request.body.kind,
    body: request.body.body
  });
  response.status(201).json({ note });
});

router.delete('/:goalId/notes/:noteId', async (request, response) => {
  await GoalNote.deleteOne({ _id: request.params.noteId, goalId: request.params.goalId, userId: request.user._id });
  response.json({ ok: true });
});

export default router;