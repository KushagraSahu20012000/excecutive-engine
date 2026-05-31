import express from 'express';
import { startOfWeek, endOfWeek, eachDayOfInterval, getDay } from 'date-fns';
import { requireAuth } from '../middleware/auth.js';
import { Setting } from '../models/Setting.js';
import { Task } from '../models/Task.js';
import { TaskCompletion } from '../models/TaskCompletion.js';
import { localDateKey } from '../utils/dates.js';
import { broadcastStatsChanged } from '../utils/realtime.js';

const router = express.Router();
router.use(requireAuth);

function activeWeekDates(settings) {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = endOfWeek(new Date(), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end })
    .filter((day) => {
      const weekday = getDay(day);
      if (weekday === 6) return settings.includeSaturday;
      if (weekday === 0) return settings.includeSunday;
      return true;
    })
    .map((day) => localDateKey(day));
}

function taskIsActiveOnDate(task, dateKey) {
  const createdKey = localDateKey(task.createdAt);
  const archivedKey = task.archivedAt ? localDateKey(task.archivedAt) : null;
  return createdKey <= dateKey && (!archivedKey || archivedKey > dateKey);
}

function taskProgressWeight(taskId, anchorTaskId) {
  return anchorTaskId && String(taskId) === String(anchorTaskId) ? 2 : 1;
}

function activeTaskTotalForDates(tasks, dates, anchorTaskId) {
  return dates.reduce(
    (total, dateKey) => total + tasks
      .filter((task) => taskIsActiveOnDate(task, dateKey))
      .reduce((dateTotal, task) => dateTotal + taskProgressWeight(task._id, anchorTaskId), 0),
    0
  );
}

router.get('/', async (request, response) => {
  const [settings, tasks] = await Promise.all([
    Setting.findOneAndUpdate(
      { userId: request.user._id },
      { $setOnInsert: { userId: request.user._id } },
      { upsert: true, new: true }
    ),
    Task.find({ userId: request.user._id, archivedAt: null }).sort({ position: 1, createdAt: 1 })
  ]);
  const today = localDateKey();
  const weekDates = activeWeekDates(settings);
  const completions = await TaskCompletion.find({
    userId: request.user._id,
    date: { $in: [...weekDates, today] }
  });
  const activeTaskIds = new Set(tasks.map((task) => String(task._id)));
  const completedThisWeek = completions.reduce((total, completion) => {
    if (!weekDates.includes(completion.date) || !activeTaskIds.has(String(completion.taskId))) return total;
    return total + taskProgressWeight(completion.taskId, settings.anchorTaskId);
  }, 0);

  response.json({
    tasks,
    completions,
    summary: {
      completed: completedThisWeek,
      total: activeTaskTotalForDates(tasks, weekDates, settings.anchorTaskId),
      weekDates
    }
  });
});

router.post('/', async (request, response) => {
  const position = await Task.countDocuments({ userId: request.user._id, archivedAt: null });
  if (position >= 7) return response.status(400).json({ message: 'You can have at most 7 active tasks. Keep them fewer and targeted first.' });
  const task = await Task.create({ userId: request.user._id, title: request.body.title, position });
  broadcastStatsChanged(request.user._id);
  response.status(201).json({ task });
});

router.patch('/:taskId', async (request, response) => {
  const task = await Task.findOneAndUpdate(
    { _id: request.params.taskId, userId: request.user._id },
    { title: request.body.title },
    { new: true }
  );
  broadcastStatsChanged(request.user._id);
  response.json({ task });
});

router.delete('/:taskId', async (request, response) => {
  await Promise.all([
    Task.findOneAndUpdate({ _id: request.params.taskId, userId: request.user._id }, { archivedAt: new Date() }),
    Setting.updateOne({ userId: request.user._id, anchorTaskId: request.params.taskId }, { anchorTaskId: null })
  ]);
  broadcastStatsChanged(request.user._id);
  response.json({ ok: true });
});

router.post('/:taskId/toggle', async (request, response) => {
  const date = request.body.date || localDateKey();
  const existing = await TaskCompletion.findOne({ userId: request.user._id, taskId: request.params.taskId, date });

  if (existing) {
    await existing.deleteOne();
    broadcastStatsChanged(request.user._id);
    return response.json({ completed: false });
  }

  await TaskCompletion.create({ userId: request.user._id, taskId: request.params.taskId, date });
  broadcastStatsChanged(request.user._id);
  response.json({ completed: true });
});

export default router;