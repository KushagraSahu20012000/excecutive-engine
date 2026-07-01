import { GoalAction } from '../models/GoalAction.js';
import { GoalActionCompletion } from '../models/GoalActionCompletion.js';
import { Goal } from '../models/Goal.js';
import { Setting } from '../models/Setting.js';
import { Task } from '../models/Task.js';
import { TaskCompletion } from '../models/TaskCompletion.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { localDateKey } from './dates.js';
import { isPushConfigured, sendPushToUser } from './webpush.js';
import { isDbConnected } from './db.js';

const APP_TIME_ZONE = 'Asia/Kolkata';
const TICK_MS = 30 * 1000;

// Nightly reminders run server-side so they fire even when the app is closed.
const NIGHTLY_UPDATE_TIME = '23:00';
const NIGHTLY_MISSED_TIME = '23:45';
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function currentTimeKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.hour}:${map.minute}`;
}

function currentWeekday(date = new Date()) {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, weekday: 'short' }).format(date);
  return WEEKDAY_INDEX[label];
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

async function runGoalActionAlarms(timeKey, dayKey) {
  // Goal tasks whose alarm time matches this minute and that have not fired today.
  const dueActions = await GoalAction.find({ time: timeKey, lastFiredKey: { $ne: dayKey } });
  if (dueActions.length === 0) return;

  const goalIds = [...new Set(dueActions.map((action) => String(action.goalId)))];
  const userIds = [...new Set(dueActions.map((action) => String(action.userId)))];
  const [goals, settings] = await Promise.all([
    Goal.find({ _id: { $in: goalIds } }),
    Setting.find({ userId: { $in: userIds } })
  ]);
  const goalById = new Map(goals.map((goal) => [String(goal._id), goal]));
  const notificationsOffFor = new Set(
    settings.filter((setting) => setting.notificationsEnabled === false).map((setting) => String(setting.userId))
  );

  for (const action of dueActions) {
    // Always advance the fire marker so a transient failure doesn't spam every tick.
    action.lastFiredKey = dayKey;
    await action.save();

    if (notificationsOffFor.has(String(action.userId))) continue;

    const goal = goalById.get(String(action.goalId));
    await sendPushToUser(action.userId, {
      title: `Task: ${action.title}`,
      body: goal ? `Goal: ${goal.title} - time to do this now.` : 'Time to do this now.',
      tag: `executive-engine-goal-task-${action._id}`,
      kind: 'goal-task',
      actionId: String(action._id),
      goalId: String(action.goalId)
    });
  }
}

async function runNightlyReminders(timeKey, dayKey, weekday) {
  const onlyIfMissed = timeKey === NIGHTLY_MISSED_TIME;
  const markerField = onlyIfMissed ? 'nightlyMissedFiredKey' : 'nightlyUpdateFiredKey';
  const kind = onlyIfMissed ? 'nightly-missed' : 'nightly-update';
  const tag = onlyIfMissed ? 'executive-engine-nightly-missed' : 'executive-engine-nightly-update';

  // Only users with at least one push subscription can receive a reminder.
  const userIds = (await PushSubscription.distinct('userId')).map((id) => String(id));
  if (userIds.length === 0) return;

  const [settings, tasks, goalActions, taskCompletions, actionCompletions] = await Promise.all([
    Setting.find({ userId: { $in: userIds } }),
    Task.find({ userId: { $in: userIds }, archivedAt: null }),
    GoalAction.find({ userId: { $in: userIds } }),
    TaskCompletion.find({ userId: { $in: userIds }, date: dayKey }),
    GoalActionCompletion.find({ userId: { $in: userIds }, date: dayKey })
  ]);

  const settingByUser = new Map(settings.map((setting) => [String(setting.userId), setting]));
  const tasksByUser = groupBy(tasks, (task) => String(task.userId));
  const actionsByUser = groupBy(goalActions, (action) => String(action.userId));
  const completedTasksByUser = groupBy(taskCompletions, (completion) => String(completion.userId));
  const completedActionsByUser = groupBy(actionCompletions, (completion) => String(completion.userId));

  for (const userId of userIds) {
    const setting = settingByUser.get(userId);
    if (setting?.notificationsEnabled === false) continue;
    if (setting?.[markerField] === dayKey) continue;
    // Stay quiet on off-days the user has excluded from their week.
    if (weekday === 6 && !setting?.includeSaturday) continue;
    if (weekday === 0 && !setting?.includeSunday) continue;

    const userTasks = tasksByUser.get(userId) || [];
    const userActions = actionsByUser.get(userId) || [];
    if (userTasks.length === 0 && userActions.length === 0) {
      await Setting.updateOne({ userId }, { $set: { [markerField]: dayKey } }, { upsert: true });
      continue;
    }

    const completedTaskIds = new Set((completedTasksByUser.get(userId) || []).map((completion) => String(completion.taskId)));
    const completedActionIds = new Set((completedActionsByUser.get(userId) || []).map((completion) => String(completion.actionId)));
    const missedTasks = userTasks.filter((task) => !completedTaskIds.has(String(task._id)));
    const missedActions = userActions.filter((action) => !completedActionIds.has(String(action._id)));

    // Mark handled first so a duplicate 30s tick within this minute cannot resend.
    await Setting.updateOne({ userId }, { $set: { [markerField]: dayKey } }, { upsert: true });

    if (onlyIfMissed && missedTasks.length === 0 && missedActions.length === 0) continue;

    const title = onlyIfMissed ? 'You still have unchecked updates' : 'Update your task status';
    const body = missedActions.length
      ? `${missedTasks.length} tasks and ${missedActions.length} goal actions need today's status.`
      : `${missedTasks.length} tasks need today's status.`;

    await sendPushToUser(userId, { title, body, tag, kind });
  }
}

async function runTick() {
  if (!isDbConnected() || !isPushConfigured()) return;

  const now = new Date();
  const timeKey = currentTimeKey(now);
  const dayKey = localDateKey(now);

  await runGoalActionAlarms(timeKey, dayKey);

  if (timeKey === NIGHTLY_UPDATE_TIME || timeKey === NIGHTLY_MISSED_TIME) {
    await runNightlyReminders(timeKey, dayKey, currentWeekday(now));
  }
}

export function startAlarmScheduler() {
  if (!isPushConfigured()) {
    console.warn('Alarm scheduler disabled: VAPID keys are not configured.');
    return () => {};
  }

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runTick();
    } catch (error) {
      console.error('Alarm scheduler tick failed', error);
    } finally {
      running = false;
    }
  };

  const interval = setInterval(tick, TICK_MS);
  void tick();
  console.log('Alarm scheduler started.');
  return () => clearInterval(interval);
}
