import { GoalAction } from '../models/GoalAction.js';
import { Goal } from '../models/Goal.js';
import { Setting } from '../models/Setting.js';
import { localDateKey } from './dates.js';
import { isPushConfigured, sendPushToUser } from './webpush.js';
import { isDbConnected } from './db.js';

const APP_TIME_ZONE = 'Asia/Kolkata';
const TICK_MS = 30 * 1000;

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

async function runTick() {
  if (!isDbConnected() || !isPushConfigured()) return;

  const now = new Date();
  const timeKey = currentTimeKey(now);
  const dayKey = localDateKey(now);

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
