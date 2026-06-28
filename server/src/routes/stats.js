import express from 'express';
import { differenceInMinutes, eachDayOfInterval, endOfWeek, format, getDay, startOfWeek, subWeeks } from 'date-fns';
import { requireAuth } from '../middleware/auth.js';
import { Deadline } from '../models/Deadline.js';
import { Setting } from '../models/Setting.js';
import { Task } from '../models/Task.js';
import { TaskCompletion } from '../models/TaskCompletion.js';
import { localDateKey, parseDateKey } from '../utils/dates.js';

const router = express.Router();
router.use(requireAuth);

function allowedDaysForWeek(start, settings) {
  return eachDayOfInterval({ start, end: endOfWeek(start, { weekStartsOn: 1 }) })
    .filter((day) => dateIsAllowed(day, settings))
    .map((day) => localDateKey(day));
}

function dateIsAllowed(day, settings) {
  const weekday = getDay(day);
  if (weekday === 6) return settings.includeSaturday;
  if (weekday === 0) return settings.includeSunday;
  return true;
}

function taskIsActiveOnDate(task, dateKey) {
  const createdKey = localDateKey(task.createdAt);
  const archivedKey = task.archivedAt ? localDateKey(task.archivedAt) : null;
  return createdKey <= dateKey && (!archivedKey || archivedKey > dateKey);
}

function historicalWeekTotal(tasks, weekDates) {
  return weekDates.reduce(
    (total, dateKey) => total + tasks.filter((task) => taskIsActiveOnDate(task, dateKey)).length,
    0
  );
}

function completionBelongsToDenominator(completion, tasksById, dateKey) {
  const task = tasksById.get(String(completion.taskId));
  if (!task) return false;
  return taskIsActiveOnDate(task, dateKey);
}

function taskDatesFromCreation(task, settings, today) {
  const start = parseDateKey(localDateKey(task.createdAt));
  if (start > today) return [];
  return eachDayOfInterval({ start, end: today })
    .filter((day) => dateIsAllowed(day, settings))
    .map((day) => localDateKey(day))
    .filter((dateKey) => taskIsActiveOnDate(task, dateKey));
}

function deadlineLeadTimeBucket(minutes) {
  if (minutes < 60) return '<1h';
  if (minutes < 360) return '1-6h';
  if (minutes < 1440) return '6-24h';
  if (minutes < 4320) return '1-3d';
  if (minutes < 10080) return '3-7d';
  return '7d+';
}

function deadlineLeadTimeHistogram(deadlines) {
  const buckets = ['<1h', '1-6h', '6-24h', '1-3d', '3-7d', '7d+'];
  const counts = new Map(buckets.map((bucket) => [bucket, 0]));

  deadlines
    .filter((deadline) => deadline.outcome === 'pass')
    .forEach((deadline) => {
      const passedAt = deadline.passedAt || deadline.updatedAt;
      const minutesBeforeDue = differenceInMinutes(deadline.dueAt, passedAt);
      if (minutesBeforeDue < 0) return;
      const bucket = deadlineLeadTimeBucket(minutesBeforeDue);
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    });

  return buckets.map((bucket) => ({ label: bucket, count: counts.get(bucket) || 0 }));
}

router.get('/', async (request, response) => {
  await Deadline.updateMany(
    { userId: request.user._id, outcome: 'pending', dueAt: { $lt: new Date() }, deletedAt: null },
    { outcome: 'fail' }
  );

  const [settings, allTasks, deadlines] = await Promise.all([
    Setting.findOneAndUpdate(
      { userId: request.user._id },
      { $setOnInsert: { userId: request.user._id } },
      { upsert: true, new: true }
    ),
    Task.find({ userId: request.user._id }),
    Deadline.find({ userId: request.user._id })
  ]);

  const activeTasks = allTasks.filter((task) => !task.archivedAt);

  const today = parseDateKey(localDateKey());
  const todayDateKey = localDateKey(today);
  const weekStarts = Array.from({ length: 8 }, (_, index) => startOfWeek(subWeeks(new Date(), 7 - index), { weekStartsOn: 1 }));
  const allDates = weekStarts.flatMap((weekStart) => allowedDaysForWeek(weekStart, settings));
  const earliestTaskDate = allTasks.reduce((earliest, task) => {
    const createdAt = parseDateKey(localDateKey(task.createdAt));
    return !earliest || createdAt < earliest ? createdAt : earliest;
  }, null);
  const completions = earliestTaskDate
    ? await TaskCompletion.find({ userId: request.user._id, date: { $gte: localDateKey(earliestTaskDate), $lte: todayDateKey } })
    : [];
  const tasksById = new Map(allTasks.map((task) => [String(task._id), task]));
  const weekly = weekStarts.map((weekStart) => {
    const weekDates = allowedDaysForWeek(weekStart, settings);
    const total = historicalWeekTotal(allTasks, weekDates);
    const completed = completions.filter((completion) => (
      weekDates.includes(completion.date)
      && completionBelongsToDenominator(completion, tasksById, completion.date)
    )).length;
    return {
      label: format(weekStart, 'MMM d'),
      percent: total ? Math.round((completed / total) * 100) : 0
    };
  });

  const byDate = new Map();
  completions.forEach((completion) => {
    if (!completionBelongsToDenominator(completion, tasksById, completion.date)) return;
    byDate.set(completion.date, (byDate.get(completion.date) || 0) + 1);
  });

  const completionKeys = new Set(completions.map((completion) => `${String(completion.taskId)}:${completion.date}`));
  const missedWindowIsWeek = request.query.missedWindow === 'week';
  const sevenDaysAgoDate = new Date(today);
  sevenDaysAgoDate.setDate(today.getDate() - 6);
  const sevenDaysAgoKey = localDateKey(sevenDaysAgoDate);
  const missedTasks = activeTasks
    .map((task) => {
      const missed = taskDatesFromCreation(task, settings, today)
        .filter((dateKey) => !completionKeys.has(`${String(task._id)}:${dateKey}`))
        .filter((dateKey) => !missedWindowIsWeek || dateKey >= sevenDaysAgoKey)
        .length;
      return { title: task.title, missed };
    })
    .filter((task) => task.missed > 0)
    .sort((a, b) => b.missed - a.missed)
    .slice(0, 6);

  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const weekday = getDay(date);
    if ((weekday === 6 && !settings.includeSaturday) || (weekday === 0 && !settings.includeSunday)) {
      continue;
    }
    const key = localDateKey(date);
    const total = allTasks.filter((task) => taskIsActiveOnDate(task, key)).length;
    if (!total) {
      continue;
    }
    const percent = ((byDate.get(key) || 0) / total) * 100;
    if (percent >= 50) streak += 1;
    else break;
  }

  response.json({
    weekly,
    deadlineRatio: [
      { name: 'Passed', value: deadlines.filter((deadline) => deadline.outcome === 'pass').length },
      { name: 'Failed', value: deadlines.filter((deadline) => deadline.outcome === 'fail').length },
      { name: 'Pending', value: deadlines.filter((deadline) => deadline.outcome === 'pending').length }
    ],
    missedTasks,
    deadlineLeadTime: deadlineLeadTimeHistogram(deadlines),
    streak
  });
});

export default router;