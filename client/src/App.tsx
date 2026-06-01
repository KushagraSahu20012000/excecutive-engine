import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addDays, differenceInSeconds, format, isBefore, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, CalendarClock, Check, ChevronDown, Flame, Goal as GoalIcon, HelpCircle, Home, LogOut, Plus, Settings2, Star, Trash2 } from 'lucide-react';
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, jsonBody } from './api';
import { MOCK_DEADLINES, MOCK_GOALS, MOCK_SETTINGS, MOCK_STATS, MOCK_TASKS, MOCK_USER } from './mockData';
import type { Completion, Deadline, Goal, Settings, Task, User } from './types';

const todayKey = () => format(new Date(), 'yyyy-MM-dd');
const CHART_COLORS = ['#0b46d8', '#e86744', '#a0a8c0'];
type Tab = 'today' | 'goals' | 'deadlines' | 'stats' | 'settings' | 'help' | 'reset';
type StatsPayload = { weekly: { label: string; percent: number }[]; deadlineRatio: { name: string; value: number }[]; missedTasks: { title: string; missed: number }[]; deadlineLeadTime: { label: string; count: number }[]; streak: number };

const DEMO_STEPS = [
  {
    tab: 'today',
    focus: 'today',
    cloud: 'bottom',
    title: 'This is your Tasks page',
    body: 'This is not a traditional todo list. It is a repeatable task system for the whole week. Your day resets at 12 AM, so mark tasks complete before the day ends. Weekly progress is on top; your task list is below.'
  },
  {
    tab: 'help',
    focus: 'help',
    cloud: 'bottom',
    title: 'Use Help when you are stuck',
    body: 'Help explains how to choose useful repeated tasks, what deserves a daily slot, and how to keep the system realistic instead of overloaded.'
  },
  {
    tab: 'reset',
    focus: 'reset',
    cloud: 'bottom',
    title: 'When you mess up',
    body: 'A miss is not the end of the system. Use this page to study what happened, find the repeat pattern, and create a countermeasure for next time.'
  },
  {
    tab: 'today',
    focus: 'checkbox',
    cloud: 'bottom',
    title: 'Tap the box when a task is done',
    body: 'Each check counts for today only, while history feeds your stats.'
  },
  {
    tab: 'today',
    focus: 'anchor',
    cloud: 'bottom',
    title: 'Use the star for your anchor task',
    body: 'The anchor is your non-negotiable. If the day collapses, protect this one.'
  },
  {
    tab: 'goals',
    focus: 'goals',
    cloud: 'bottom',
    title: 'Create a long term goal',
    body: 'Use Goals for outcomes that take weeks or months. Create the goal, add a deadline, and keep the outcome visible enough that it does not disappear into daily noise.'
  },
  {
    tab: 'goals',
    focus: 'goalDetail',
    cloud: 'bottom',
    title: 'Add daily actions and notes',
    body: 'Break the goal into daily actions, mark them complete at the end of the day, and note what worked and what did not. This turns the goal into a system you can improve.'
  },
  {
    tab: 'deadlines',
    focus: 'deadlines',
    cloud: 'bottom',
    title: 'Deadlines track one time tasks',
    body: 'Deadlines help you keep track of time sensitive one time tasks. Mark pass or fail so you know whether you handled the pressure before time ran out.'
  },
  {
    tab: 'stats',
    focus: 'stats',
    cloud: 'bottom',
    title: 'Track progress and system quality',
    body: 'Use streaks, weekly completion, and deadlines to track progress and the quality of the system. Monitor most missed tasks, then remove or modify the most missed ones to adjust the system.'
  },
  {
    tab: 'today',
    focus: 'tabs',
    cloud: 'bottom',
    title: 'Use the bottom tabs to move around',
    body: 'Today, Goals, Deadlines, and Stats are the main loop. Skip when you are ready to register.'
  }
] as const;

type DemoStep = (typeof DEMO_STEPS)[number];

function demoTargetSelector(focus: DemoStep['focus']) {
  const selectors: Record<DemoStep['focus'], string> = {
    today: '.hero-card',
    help: '.help-card:first-child',
    reset: '.help-card:first-child',
    checkbox: '.task-item:first-child .pencil-box',
    anchor: '.task-item:first-child .anchor-button',
    goals: '.goal-title-row:first-child',
    goalDetail: '.goal-card',
    deadlines: '.deadline-card:first-of-type',
    stats: '.chart-card:first-of-type',
    tabs: '.tabbar'
  };

  return selectors[focus];
}

function hasTwoWeekDrop(weekly: { percent: number }[]) {
  if (weekly.length < 3) return false;
  const [twoWeeksAgo, lastWeek, currentWeek] = weekly.slice(-3);
  return currentWeek.percent < lastWeek.percent && lastWeek.percent < twoWeeksAgo.percent;
}

function dateKeyFromValue(value?: string) {
  return value ? format(parseISO(value), 'yyyy-MM-dd') : todayKey();
}

function goalProgressData(goal: Goal) {
  const today = todayKey();
  const dates = Array.from({ length: 14 }, (_, index) => format(addDays(new Date(), index - 13), 'yyyy-MM-dd'));
  const series = dates.map((date) => {
    const activeActions = goal.actions.filter((action) => dateKeyFromValue(action.createdAt) <= date);
    const completed = new Set(goal.completions.filter((completion) => completion.date === date).map((completion) => completion.actionId));
    const done = activeActions.filter((action) => completed.has(action._id)).length;
    const total = activeActions.length;
    return {
      date,
      label: format(parseISO(date), 'MMM d'),
      percent: total ? Math.round((done / total) * 100) : 0,
      done,
      total
    };
  });
  const current = series.find((point) => point.date === today) || series[series.length - 1];
  return { series, current };
}

function DemoCloud({ step, stepIndex, onBack, onNext, onSkip }: { step: DemoStep; stepIndex: number; onBack: () => void; onNext: () => void; onSkip: () => void }) {
  const isFinalStep = stepIndex === DEMO_STEPS.length - 1;

  return (
    <div className="demo-tour-layer" aria-live="polite">
      <motion.section key={step.title} className={`demo-cloud demo-cloud-${step.cloud}`} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.18 }}>
        <p className="eyebrow">Demo {stepIndex + 1} / {DEMO_STEPS.length}</p>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="demo-cloud-actions">
          {stepIndex > 0 && <button type="button" className="secondary-action" onClick={onBack}>Back</button>}
          <button type="button" onClick={onNext}>{isFinalStep ? 'Create account' : 'Next'}</button>
        </div>
      </motion.section>
      <button type="button" className="demo-skip-button" onClick={onSkip}>Skip demo</button>
    </div>
  );
}

function Login({ onAuth, initialMode = 'login' }: { onAuth: (user: User) => void; initialMode?: 'login' | 'signup' }) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const path = mode === 'signup' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'signup' ? { displayName, email, password } : { email, password };
      const response = await api<{ user: User }>(path, { method: 'POST', ...jsonBody(payload) });
      onAuth(response.user);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel glass-panel">
        <p className="brand-mark">Executive Engine</p>
        <h1>Get out of your head and on track today.</h1>
        <p className="muted">An executive assistant for people who struggle with ADHD or executive function, organization, follow-through, or keeping consistent discipline. Use it for daily tasks, long-range goals, deadlines, and keep compounding the progress.</p>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && (
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
              required
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            minLength={6}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-action" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button className="secondary-action" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
          {mode === 'signup' ? 'Have an account? Sign in' : 'Need an account? Create one'}
        </button>
      </section>
    </main>
  );
}

function DemoBanner() {
  return <div className="demo-banner">Guided demo — sample data only. Create an account when you are ready to save your own system.</div>;
}

function PencilTick({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button className={`pencil-box ${checked ? 'checked' : ''}`} onClick={onClick} aria-label="Toggle completion">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <motion.path d="M8.5 25.2c5.3 2.4 9.8 5.9 14.1 10.4 5.9-12.8 12.7-21 21.4-27.2" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 130, damping: 19 }} />
        <motion.path d="M9.8 27.4c4.7 1.7 8.8 4.8 12.3 8.3 6.1-12.1 12.8-20.2 20.1-25.7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 0.55 : 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: checked ? 0.04 : 0 }} />
      </svg>
    </button>
  );
}

function encouragement(p: number) {
  if (p === 0) return 'Lets Start';
  if (p === 100) return 'You have achieved greatness';
  if (p >= 75) return 'Almost at peak';
  if (p >= 50) return 'You did great';
  if (p >= 25) return 'Possible victory';
  return 'Great going';
}

function TodayPage({ demo, tasks, settings, setTasks, onChangeSettings, onOpenHelp, onOpenMessUp }: { demo: boolean; tasks: Task[]; settings: Settings; setTasks: React.Dispatch<React.SetStateAction<Task[]>>; onChangeSettings: (next: Settings) => Promise<void>; onOpenHelp: () => void; onOpenMessUp: () => void }) {
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [summary, setSummary] = useState({ completed: demo ? 7 : 0, total: demo ? 20 : 0, weekDates: [] as string[] });
  const [currentDay, setCurrentDay] = useState(todayKey());
  const [title, setTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [demoChecked, setDemoChecked] = useState<Set<string>>(new Set(['t1', 't3']));
  const [showAnchorIntro, setShowAnchorIntro] = useState(false);
  const [showTaskLimitWarning, setShowTaskLimitWarning] = useState(false);

  async function load() {
    const d = await api<{ tasks: Task[]; completions: Completion[]; summary: typeof summary }>('/api/tasks');
    setTasks(d.tasks); setCompletions(d.completions); setSummary(d.summary);
  }
  useEffect(() => { if (!demo) void load(); }, [demo]);

  useEffect(() => {
    let timeoutId = 0;
    function scheduleMidnightRollover() {
      const now = new Date();
      const nextDay = new Date(now);
      nextDay.setHours(24, 0, 0, 0);
      timeoutId = window.setTimeout(() => {
        setCurrentDay(todayKey());
        if (demo) setDemoChecked(new Set());
        else void load();
        scheduleMidnightRollover();
      }, nextDay.getTime() - now.getTime());
    }
    scheduleMidnightRollover();
    return () => window.clearTimeout(timeoutId);
  }, [demo]);

  const pct = demo ? 35 : (summary.total ? Math.round((summary.completed / summary.total) * 100) : 0);
  const completedToday = demo ? demoChecked : new Set(completions.filter((c) => c.date === currentDay).map((c) => c.taskId));
  const taskLimitReached = tasks.length >= 7;

  async function addTask(e: FormEvent) {
    e.preventDefault(); if (!title.trim()) return;
    if (taskLimitReached) { setShowTaskLimitWarning(true); return; }
    const nextCount = tasks.length + 1;
    if (demo) { setTasks((p) => [...p, { _id: `t${Date.now()}`, title, position: p.length }]); setTitle(''); setAddingTask(false); if (nextCount >= 7) setShowTaskLimitWarning(true); return; }
    const optimisticTask = { _id: `pending-${Date.now()}`, title, position: tasks.length };
    setTasks((previous) => [...previous, optimisticTask]);
    setTitle(''); setAddingTask(false); if (nextCount >= 7) setShowTaskLimitWarning(true);
    void api('/api/tasks', { method: 'POST', ...jsonBody({ title }) }).then(load).catch(load);
  }

  async function toggleTask(id: string) {
    if (demo) { setDemoChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); return; }
    const wasCompleted = completedToday.has(id);
    const checkWeight = settings.anchorTaskId === id ? 2 : 1;
    setCompletions((previous) => wasCompleted ? previous.filter((completion) => !(completion.taskId === id && completion.date === currentDay)) : [...previous, { _id: `pending-${Date.now()}`, taskId: id, date: currentDay }]);
    setSummary((previous) => ({ ...previous, completed: Math.max(0, previous.completed + (wasCompleted ? -checkWeight : checkWeight)) }));
    void api(`/api/tasks/${id}/toggle`, { method: 'POST', ...jsonBody({ date: currentDay }) }).then(load).catch(load);
  }

  async function toggleAnchorTask(taskId: string) {
    const isSelecting = settings.anchorTaskId !== taskId;
    if (isSelecting) setShowAnchorIntro(true);
    await onChangeSettings({ ...settings, anchorTaskId: isSelecting ? taskId : null });
    if (!demo) await load();
  }

  const displayed = demo ? 7 : summary.completed;
  const total = demo ? 20 : summary.total;

  return (
    <motion.section className="page-grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <article className="card hero-card span-12">
        <p className="eyebrow">Today</p>
        <h1>{encouragement(pct)}</h1>
        <div className="progress-line"><span style={{ width: `${pct}%` }} /></div>
        <div className="stat-row"><strong>{displayed}</strong><span>/ {total} weekly checks</span><b>{pct}%</b></div>
      </article>
      <article className="card span-12">
        <div className="task-list">
          {tasks.map((task, index) => (
            <div className="task-item" key={task._id}>
              <PencilTick checked={completedToday.has(task._id)} onClick={() => void toggleTask(task._id)} />
              <span>{task.title}</span>
              {(!settings.anchorTaskId || settings.anchorTaskId === task._id) && (
                <button className={`anchor-button ${settings.anchorTaskId === task._id ? 'is-anchor' : ''} ${!settings.anchorTaskId && index === 0 ? 'is-suggested' : ''}`.trim()} type="button" onClick={() => void toggleAnchorTask(task._id)} aria-label={`${settings.anchorTaskId === task._id ? 'Remove' : 'Set'} anchor task`} data-tooltip={settings.anchorTaskId === task._id ? 'Remove Anchor' : 'Make Anchor'}>
                  <Star size={18} fill={settings.anchorTaskId === task._id ? 'currentColor' : 'none'} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!taskLimitReached && (addingTask || tasks.length === 0) ? (
          <>
            {tasks.length === 0 && (
              <div className="empty-task-help">
                <p>Not sure what to add?</p>
                <button className="help-recommend-button" type="button" onClick={onOpenHelp}>
                  <HelpCircle size={17} />
                  <span><strong>Recommended</strong><small>Open Help</small></span>
                </button>
              </div>
            )}
            <form className="inline-form task-add-form" onSubmit={addTask}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a repeating task" autoFocus />
              <button aria-label="Save task"><Plus size={18} /></button>
            </form>
          </>
        ) : !taskLimitReached ? (
          <div className="task-actions-footer">
            <button className={`task-add-trigger ${tasks.length >= 4 ? 'is-subtle' : ''}`.trim()} type="button" onClick={() => setAddingTask(true)}><Plus size={18} /> Add</button>
            <MessUpButton onClick={onOpenMessUp} />
          </div>
        ) : (
          null
        )}
      </article>
      <AnimatePresence>
        {showAnchorIntro && <AnchorIntroDialog onClose={() => setShowAnchorIntro(false)} />}
        {showTaskLimitWarning && <TaskLimitDialog onClose={() => setShowTaskLimitWarning(false)} />}
      </AnimatePresence>
    </motion.section>
  );
}

function TaskLimitDialog({ onClose }: { onClose: () => void }) {
  return (
    <motion.div className="anchor-dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="anchor-dialog" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} role="dialog" aria-modal="true" aria-labelledby="task-limit-title">
        <p className="eyebrow">Task limit</p>
        <h2 id="task-limit-title">Keep it targeted</h2>
        <p>Seven tasks is the limit. It is better to keep fewer, targeted tasks and reach 100% on them first before adding more.</p>
        <button type="button" onClick={onClose}>Got it</button>
      </motion.div>
    </motion.div>
  );
}

function AnchorIntroDialog({ onClose }: { onClose: () => void }) {
  return (
    <motion.div className="anchor-dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="anchor-dialog" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} role="dialog" aria-modal="true" aria-labelledby="anchor-dialog-title">
        <p className="eyebrow">Anchor task</p>
        <h2 id="anchor-dialog-title">Your non-negotiable</h2>
        <p>An anchor is the one task that keeps you grounded in routine and consistent life. It counts as two checks because protecting it matters more than an ordinary task.</p>
        <button type="button" onClick={onClose}>Got it</button>
      </motion.div>
    </motion.div>
  );
}

function countdown(dt: string) {
  const s = Math.max(0, differenceInSeconds(parseISO(dt), new Date()));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

function deadlineRemaining(dt: string) {
  const seconds = Math.max(0, differenceInSeconds(parseISO(dt), new Date()));
  if (seconds === 0) return { value: 0, unit: 'minutes' };
  if (seconds < 3600) return { value: Math.max(1, Math.ceil(seconds / 60)), unit: 'minutes' };
  if (seconds < 86400) return { value: Math.ceil(seconds / 3600), unit: 'hours' };
  return { value: Math.ceil(seconds / 86400), unit: 'days' };
}

function GoalsPage({ demo, demoOpenGoal = false, onOpenMessUp }: { demo: boolean; demoOpenGoal?: boolean; onOpenMessUp: () => void }) {
  const [goals, setGoals] = useState<Goal[]>(demo ? MOCK_GOALS : []);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', deadlineAt: format(addDays(new Date(), 30), "yyyy-MM-dd'T'HH:mm") });
  const [tick, setTick] = useState(0);
  const [goalDeleteTarget, setGoalDeleteTarget] = useState<Goal | null>(null);

  async function load() { const d = await api<{ goals: Goal[] }>('/api/goals'); setGoals(d.goals); }

  useEffect(() => {
    if (!demo) void load();
    const iv = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(iv);
  }, [demo]);

  useEffect(() => {
    if (demoOpenGoal && goals[0]) setSelectedGoalId(goals[0]._id);
    if (!demoOpenGoal && selectedGoalId && demo) setSelectedGoalId(null);
  }, [demo, demoOpenGoal, goals, selectedGoalId]);

  async function addGoal(e: FormEvent) {
    e.preventDefault(); if (!form.title.trim()) return;
    if (demo) { setGoals((p) => [...p, { _id: `g${Date.now()}`, ...form, actions: [], notes: [], completions: [] }]); setForm({ title: '', description: '', deadlineAt: format(addDays(new Date(), 30), "yyyy-MM-dd'T'HH:mm") }); return; }
    await api('/api/goals', { method: 'POST', ...jsonBody(form) }); setForm({ title: '', description: '', deadlineAt: format(addDays(new Date(), 30), "yyyy-MM-dd'T'HH:mm") }); await load();
  }

  function requestGoalDelete(goalId: string) {
    const goal = goals.find((item) => item._id === goalId);
    if (goal) setGoalDeleteTarget(goal);
  }

  async function confirmGoalDelete() {
    const goal = goalDeleteTarget;
    if (!goal) return;
    setGoalDeleteTarget(null);
    setGoals((previous) => previous.filter((item) => item._id !== goal._id));
    if (selectedGoalId === goal._id) setSelectedGoalId(null);
    if (!demo) { await api(`/api/goals/${goal._id}`, { method: 'DELETE' }); await load(); }
  }

  async function addAction(gid: string, title: string) {
    if (!title.trim()) return;
    if (demo) { setGoals((p) => p.map((g) => g._id === gid ? { ...g, actions: [...g.actions, { _id: `a${Date.now()}`, title }] } : g)); return; }
    await api(`/api/goals/${gid}/actions`, { method: 'POST', ...jsonBody({ title }) }); await load();
  }

  async function removeAction(gid: string, aid: string) {
    if (demo) {
      setGoals((p) => p.map((g) => g._id === gid ? { ...g, actions: g.actions.filter((a) => a._id !== aid), completions: g.completions.filter((c) => c.actionId !== aid) } : g));
      return;
    }
    await api(`/api/goals/${gid}/actions/${aid}`, { method: 'DELETE' }); await load();
  }

  async function toggleAction(gid: string, aid: string) {
    setGoals((p) => p.map((g) => {
      if (g._id !== gid) return g;
      const date = todayKey();
      const done = g.completions.some((c) => c.actionId === aid && c.date === date);
      return { ...g, completions: done ? g.completions.filter((c) => !(c.actionId === aid && c.date === date)) : [...g.completions, { _id: `c${Date.now()}`, actionId: aid, date }] };
    }));
    if (!demo) void api(`/api/goals/${gid}/actions/${aid}/toggle`, { method: 'POST', ...jsonBody({ date: todayKey() }) }).then(load).catch(load);
  }

  async function addNote(gid: string, kind: 'works' | 'doesnt', body: string) {
    if (!body.trim()) return;
    if (demo) { setGoals((p) => p.map((g) => g._id === gid ? { ...g, notes: [...g.notes, { _id: `n${Date.now()}`, kind, body }] } : g)); return; }
    await api(`/api/goals/${gid}/notes`, { method: 'POST', ...jsonBody({ kind, body }) }); await load();
  }

  const selectedGoal = goals.find((goal) => goal._id === selectedGoalId) || null;

  if (selectedGoal) {
    const t = countdown(selectedGoal.deadlineAt);
    const currentDate = todayKey();
    const done = new Set(selectedGoal.completions.filter((c) => c.date === currentDate).map((c) => c.actionId));
    const progress = goalProgressData(selectedGoal);
    return (
      <motion.section className="page-grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
        <article className="card goal-card span-12" key={selectedGoal._id}>
          <button className="text-button" onClick={() => setSelectedGoalId(null)}>Goals</button>
          <div className="goal-head">
            <div><p className="eyebrow">Goal</p><h2>{selectedGoal.title}</h2><p className="muted">{selectedGoal.description}</p></div>
            <div className="countdown glass-panel"><b>{t.days}</b><span>d</span><b>{t.hours}</b><span>h</span><b>{t.minutes}</b><span>m</span><b>{t.seconds}</b><span>s</span></div>
          </div>
          <GoalTools goal={selectedGoal} completed={done} onAddAction={addAction} onToggleAction={toggleAction} onRemoveAction={removeAction} onAddNote={addNote} />
          <GoalProgressPanel progress={progress} />
          <MessUpButton onClick={onOpenMessUp} />
        </article>
      </motion.section>
    );
  }

  return (
    <motion.section className="page-grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <article className="card span-12">
        <p className="eyebrow">Goals</p>
        <p className="goal-page-note">Create long term goals, give each one a daily action plan, and add notes based on what works.</p>
        <form className="goal-form" onSubmit={addGoal}>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Goal title" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
          <input type="datetime-local" value={form.deadlineAt} onChange={(e) => setForm({ ...form, deadlineAt: e.target.value })} />
          <button><Plus size={18} /> Goal</button>
        </form>
      </article>
      <article className="card span-12">
        {goals.length === 0 ? (
          <div className="empty-goals-title">No Goals</div>
        ) : (
          <div className="goal-title-list">
            {goals.map((goal, index) => (
              <div className="goal-title-row" data-tone={(index % 5) + 1} key={goal._id} role="button" tabIndex={0} onClick={() => setSelectedGoalId(goal._id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedGoalId(goal._id); } }}>
                <span className="goal-title-name">{goal.title}</span>
                <button className="goal-open-button" onClick={(event) => { event.stopPropagation(); setSelectedGoalId(goal._id); }} aria-label={`Open ${goal.title}`}>Open <span aria-hidden="true">↗</span></button>
                <button className="icon-button goal-delete-button" onClick={(event) => { event.stopPropagation(); requestGoalDelete(goal._id); }} aria-label={`Delete ${goal.title}`}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </article>
      {goals.length > 0 && (
        <article className="card span-12">
          <MessUpButton onClick={onOpenMessUp} />
        </article>
      )}
      <AnimatePresence>
        {goalDeleteTarget && <GoalDeleteDialog goal={goalDeleteTarget} onConfirm={() => void confirmGoalDelete()} onCancel={() => setGoalDeleteTarget(null)} />}
      </AnimatePresence>
    </motion.section>
  );
}

function GoalDeleteDialog({ goal, onConfirm, onCancel }: { goal: Goal; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div className="anchor-dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="anchor-dialog confirm-dialog" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} role="dialog" aria-modal="true" aria-labelledby="goal-delete-title">
        <p className="eyebrow">Delete goal</p>
        <h2 id="goal-delete-title">Delete {goal.title}?</h2>
        <p>This will remove the goal, its daily actions, notes, and completion history. This cannot be undone.</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="secondary-action" onClick={onCancel}>Cancel</button>
          <button type="button" className="danger-action" onClick={onConfirm}>Confirm delete</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GoalProgressPanel({ progress }: { progress: ReturnType<typeof goalProgressData> }) {
  return (
    <section className="goal-progress-panel">
      <div className="goal-progress-head">
        <div>
          <p className="eyebrow">Daily progress</p>
          <h2>{progress.current.percent}%</h2>
        </div>
        <p>{progress.current.done} / {progress.current.total} actions today</p>
      </div>
      <div className="chart-frame goal-progress-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={progress.series} margin={{ top: 8, right: 12, left: -12, bottom: 2 }}>
            <XAxis dataKey="label" tickMargin={10} />
            <YAxis domain={[0, 100]} width={34} tickMargin={5} />
            <Tooltip />
            <Line type="monotone" dataKey="percent" stroke="#0b46d8" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function MessUpButton({ onClick }: { onClick: () => void }) {
  return (
    <section className="mess-up-guide">
      <button type="button" className="mess-up-toggle" onClick={onClick}>When you mess up - click here</button>
    </section>
  );
}

function MessUpPage({ onBack }: { onBack: () => void }) {
  return (
    <motion.section className="page-grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <article className="card help-card span-12">
        <button className="text-button" onClick={onBack}>Back</button>
        <p className="eyebrow">Reset protocol</p>
        <h1>When you mess up</h1>
        <p className="help-purpose">It is okay. No need to be mean to yourself. Become Sherlock Holmes and solve this case.</p>
        <p className="help-lede">A miss is not a verdict on you. It is evidence. Use it to understand how your system broke, then make the next version harder to break.</p>
      </article>
      <article className="card help-card span-12">
        <p className="eyebrow">Step 1</p>
        <h2>Study the failure without attacking yourself</h2>
        <p>You are allowed to mess up, because messing up exposes your tendencies. Once you can see the pattern, you can close the gap and implement new measures that change the behavior.</p>
      </article>
      <article className="card help-card span-12">
        <p className="eyebrow">Step 2</p>
        <h2>Solve the case</h2>
        <ul className="help-list compact-help-list">
          <li><strong>What happened?</strong> Write the actual sequence, not the vague summary.</li>
          <li><strong>Why is this happening?</strong> Go deeper than the obvious reason.</li>
          <li><strong>What need was being met?</strong> Avoidance usually gives relief, stimulation, comfort, control, or escape.</li>
          <li><strong>How do you solve this so it does not happen again?</strong> Change the system, not just the intention.</li>
        </ul>
      </article>
      <article className="card help-card span-12">
        <p className="eyebrow">Step 3</p>
        <h2>Create a contingency plan</h2>
        <p>Be direct, honest, and detailed. Focus on your behavior and create specific plans for self-destructive patterns before they repeat. When you reset, come back to 4 to 6 must-do items.</p>
        <div className="help-principle-grid">
          <div><strong>Trigger</strong><span>What reliably starts the slide?</span></div>
          <div><strong>Pattern</strong><span>What do you usually do next?</span></div>
          <div><strong>Cost</strong><span>What does this steal from you later?</span></div>
          <div><strong>Countermeasure</strong><span>What will you do instead, exactly?</span></div>
        </div>
      </article>
      <article className="card help-card span-12">
        <p className="eyebrow">Examples</p>
        <h2>Find the repeat pattern</h2>
        <p>You might discover that after every 6 days, you stop working and go back to an old activity. Or you might discover that every time you text a certain person, you open yourself up to a freefall emotional state that takes weeks to recover from.</p>
        <p className="help-note">The point is not guilt. The point is pattern recognition, then system modification.</p>
      </article>
    </motion.section>
  );
}

function GoalTools({ goal, completed, onAddAction, onToggleAction, onRemoveAction, onAddNote }: { goal: Goal; completed: Set<string>; onAddAction: (g: string, t: string) => Promise<void>; onToggleAction: (g: string, a: string) => Promise<void>; onRemoveAction: (g: string, a: string) => Promise<void>; onAddNote: (g: string, k: 'works' | 'doesnt', b: string) => Promise<void> }) {
  const [at, setAt] = useState(''); const [wk, setWk] = useState(''); const [dn, setDn] = useState('');
  return (
    <div className="goal-tools">
      <GoalSection title="Daily action" value={at} onChange={setAt} placeholder="Add daily action" onAdd={() => onAddAction(goal._id, at).then(() => setAt(''))}>
        {goal.actions.map((a) => (
          <div className="daily-action-row" key={a._id}>
            <button className="check-row" onClick={() => void onToggleAction(goal._id, a._id)}>
              <span className={completed.has(a._id) ? 'dot done' : 'dot'}><Check size={13} /></span>{a.title}
            </button>
            <button className="section-icon-button daily-action-delete" type="button" onClick={() => void onRemoveAction(goal._id, a._id)} aria-label={`Delete ${a.title}`}><Trash2 size={15} /></button>
          </div>
        ))}
      </GoalSection>
      <NotePanel title="What works" value={wk} onChange={setWk} notes={goal.notes.filter((n) => n.kind === 'works').map((n) => n.body)} onAdd={() => onAddNote(goal._id, 'works', wk).then(() => setWk(''))} />
      <NotePanel title="What doesn't work" value={dn} onChange={setDn} notes={goal.notes.filter((n) => n.kind === 'doesnt').map((n) => n.body)} onAdd={() => onAddNote(goal._id, 'doesnt', dn).then(() => setDn(''))} />
    </div>
  );
}

function GoalSection({ title, value, placeholder, children, onChange, onAdd }: { title: string; value: string; placeholder: string; children: React.ReactNode; onChange: (v: string) => void; onAdd: () => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(true);
  async function submitAdd(event?: FormEvent) {
    event?.preventDefault();
    if (!value.trim()) return;
    await onAdd();
    setAdding(false);
  }
  return (
    <div className="sub-panel">
      <div className="goal-section-head">
        <h3>{title}</h3>
        <div>
          {!adding && <button className="section-icon-button" type="button" onClick={() => setAdding(true)} aria-label={`Add ${title}`}><Plus size={15} /></button>}
          <button className="section-icon-button" type="button" onClick={() => setOpen((current) => !current)} aria-label={`${open ? 'Hide' : 'Show'} ${title}`}><ChevronDown className={open ? '' : 'is-closed'} size={17} /></button>
        </div>
      </div>
      <AnimatePresence>
        {adding && (
          <motion.form className="mini-form section-add-form" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} onSubmit={submitAdd}>
            <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoFocus />
            <button className="section-icon-button section-submit-button" type="submit" aria-label={`Save ${title}`}><Plus size={18} strokeWidth={2.4} /></button>
          </motion.form>
        )}
      </AnimatePresence>
      {open && <div className="goal-section-body">{children}</div>}
    </div>
  );
}

function NotePanel({ title, value, notes, onChange, onAdd }: { title: string; value: string; notes: string[]; onChange: (v: string) => void; onAdd: () => Promise<void> }) {
  return (
    <GoalSection title={title} value={value} onChange={onChange} placeholder="Add note" onAdd={onAdd}>
      <ul>{notes.map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}</ul>
    </GoalSection>
  );
}

function DeadlinesPage({ demo }: { demo: boolean }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>(demo ? MOCK_DEADLINES : []);
  const [form, setForm] = useState({ title: '', description: '', dueAt: format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm") });
  const [celebratingDeadlineId, setCelebratingDeadlineId] = useState<string | null>(null);

  async function load() { const d = await api<{ deadlines: Deadline[] }>('/api/deadlines'); setDeadlines(d.deadlines); }
  useEffect(() => { if (!demo) void load(); }, [demo]);

  async function addDeadline(e: FormEvent) {
    e.preventDefault(); if (!form.title.trim()) return;
    if (demo) { setDeadlines((p) => [...p, { _id: `d${Date.now()}`, ...form, outcome: 'pending' }]); setForm({ title: '', description: '', dueAt: format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm") }); return; }
    await api('/api/deadlines', { method: 'POST', ...jsonBody(form) }); setForm({ title: '', description: '', dueAt: format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm") }); await load();
  }

  async function togglePass(dl: Deadline) {
    const nextOutcome = dl.outcome === 'pass' ? 'pending' : 'pass';
    if (nextOutcome === 'pass') {
      setCelebratingDeadlineId(dl._id);
      window.setTimeout(() => setCelebratingDeadlineId((current) => current === dl._id ? null : current), 900);
    }

    setDeadlines((p) => p.map((d) => d._id === dl._id ? { ...d, outcome: nextOutcome } : d));
    if (!demo) void api(`/api/deadlines/${dl._id}`, { method: 'PATCH', ...jsonBody({ ...dl, outcome: nextOutcome }) }).then(load).catch(load);
  }

  async function removeDeadline(deadlineId: string) {
    setDeadlines((previous) => previous.filter((deadline) => deadline._id !== deadlineId));
    if (!demo) { await api(`/api/deadlines/${deadlineId}`, { method: 'DELETE' }); await load(); }
  }

  const sortedDeadlines = [...deadlines].sort((left, right) => {
    const leftOutcome = left.outcome === 'pending' && isBefore(parseISO(left.dueAt), new Date()) ? 'fail' : left.outcome;
    const rightOutcome = right.outcome === 'pending' && isBefore(parseISO(right.dueAt), new Date()) ? 'fail' : right.outcome;
    const outcomeOrder = { pending: 0, pass: 1, fail: 2 };
    const outcomeDelta = outcomeOrder[leftOutcome] - outcomeOrder[rightOutcome];
    if (outcomeDelta) return outcomeDelta;
    return parseISO(right.dueAt).getTime() - parseISO(left.dueAt).getTime();
  });

  return (
    <motion.section className="page-grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <article className="card span-12">
        <p className="eyebrow">Deadlines</p>
        <form className="goal-form" onSubmit={addDeadline}>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Deadline title" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
          <input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          <button><Plus size={18} /> Deadline</button>
        </form>
      </article>
      {sortedDeadlines.map((dl) => {
        const overdue = dl.outcome === 'pending' && isBefore(parseISO(dl.dueAt), new Date());
        const dueDate = parseISO(dl.dueAt);
        const outcome = overdue ? 'fail' : dl.outcome;
        const remaining = deadlineRemaining(dl.dueAt);
        return (
          <article className="card deadline-row deadline-card span-12" key={dl._id}>
            <div><h2>{dl.title}</h2><p className="muted">{dl.description || 'No description'}</p></div>
            <div className="deadline-date-block" aria-label={format(dueDate, 'PPpp')}>
              <strong>{remaining.value} <span>{remaining.unit}</span></strong>
              <em>remaining</em>
              <small>{format(dueDate, 'EEE, MMM d')} · {format(dueDate, 'p')}</small>
            </div>
            <span className={`status ${outcome}`}>{outcome}</span>
            <div className="deadline-actions">
              {outcome !== 'fail' ? (
                <div className="celebration-wrap">
                  <button className={dl.outcome === 'pass' ? 'pass-toggle is-passed' : 'pass-toggle'} onClick={() => void togglePass(dl)}>{dl.outcome === 'pass' ? 'Unpass' : 'Pass'}</button>
                  <AnimatePresence>{celebratingDeadlineId === dl._id && <FireworkBurst />}</AnimatePresence>
                </div>
              ) : (
                <span className="deadline-action-spacer" aria-hidden="true" />
              )}
              <button className="icon-button" onClick={() => void removeDeadline(dl._id)} aria-label={`Delete ${dl.title}`}><Trash2 size={17} /></button>
            </div>
          </article>
        );
      })}
    </motion.section>
  );
}

function FireworkBurst() {
  const sparks = Array.from({ length: 14 }, (_, index) => index);
  return (
    <motion.div className="firework-burst" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true">
      {sparks.map((spark) => {
        const angle = (Math.PI * 2 * spark) / sparks.length;
        const distance = 30 + (spark % 4) * 7;
        return (
          <motion.span
            key={spark}
            style={{ '--x': `${Math.cos(angle) * distance}px`, '--y': `${Math.sin(angle) * distance}px` } as React.CSSProperties}
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.2], x: `var(--x)`, y: `var(--y)` }}
            transition={{ duration: 0.68, ease: 'easeOut' }}
          />
        );
      })}
    </motion.div>
  );
}

function StatsPage({ demo }: { demo: boolean }) {
  const [stats, setStats] = useState(demo ? MOCK_STATS : { weekly: [] as { label: string; percent: number }[], deadlineRatio: [] as { name: string; value: number }[], missedTasks: [] as { title: string; missed: number }[], deadlineLeadTime: [] as { label: string; count: number }[], streak: 0 });
  const hasMissedTasks = stats.missedTasks.length > 0;
  const hasDeadlines = stats.deadlineRatio.some((entry) => entry.value > 0);
  const hasDeadlineLeadTime = stats.deadlineLeadTime.some((entry) => entry.count > 0);

  useEffect(() => {
    if (demo) return;

    const loadStats = () => api<typeof stats>('/api/stats').then(setStats).catch(() => undefined);
    void loadStats();

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = import.meta.env.VITE_WS_BASE_URL || `${wsProtocol}://${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;

      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { type?: string };
          if (payload.type === 'stats:changed') {
            void loadStats();
          }
        } catch (_error) {
          // Ignore invalid message payloads from intermediary proxies.
        }
      };

      socket.onclose = () => {
        if (isDisposed) return;
        reconnectTimer = window.setTimeout(connect, 1200);
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [demo]);

  return (
    <motion.section className="page-grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <article className="card hero-card stats-hero span-12"><p className="eyebrow">Streak</p><h1><Flame size={34} /> {stats.streak} days</h1></article>
      <article className="card chart-card span-12">
        <h2>Weekly completion</h2>
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.weekly} margin={{ top: 10, right: 14, left: -10, bottom: 2 }}><XAxis dataKey="label" tickMargin={10} /><YAxis domain={[0, 100]} width={36} tickMargin={5} /><Tooltip /><Line type="monotone" dataKey="percent" stroke="#0b46d8" strokeWidth={3} dot={false} /></LineChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="card chart-card span-12">
        <h2>Most missed tasks</h2>
        <div className="chart-frame">
          {hasMissedTasks ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.missedTasks} layout="vertical" margin={{ top: 8, right: 14, left: 4, bottom: 2 }}><XAxis type="number" allowDecimals={false} /><YAxis dataKey="title" type="category" width={150} tickMargin={8} /><Tooltip /><Bar dataKey="missed" fill="#e86744" radius={[0, 5, 5, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty-state">No Tasks Missed</div>
          )}
        </div>
      </article>
      <article className="card chart-card span-12">
        <h2>Deadlines</h2>
        <div className="chart-frame chart-frame-pie">
          {hasDeadlines ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}><Pie data={stats.deadlineRatio} dataKey="value" innerRadius={58} outerRadius={90}>{stats.deadlineRatio.map((e, i) => <Cell key={e.name} fill={CHART_COLORS[i % 3]} />)}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty-state">No Deadlines added</div>
          )}
        </div>
      </article>
      <article className="card chart-card span-12">
        <h2>Pass timing</h2>
        <div className="chart-frame">
          {hasDeadlineLeadTime ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.deadlineLeadTime} margin={{ top: 8, right: 14, left: -10, bottom: 2 }}><XAxis dataKey="label" tickMargin={10} /><YAxis allowDecimals={false} width={34} tickMargin={5} /><Tooltip /><Bar dataKey="count" fill="#0b46d8" radius={[5, 5, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty-state">No Passed Deadlines</div>
          )}
        </div>
      </article>
    </motion.section>
  );
}

function SettingsPage({ settings, tasks, onChange, onRemoveTask }: { settings: Settings; tasks: Task[]; onChange: (next: Settings) => void; onRemoveTask: (taskId: string) => void }) {
  return (
    <motion.section className="page-grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <article className="card compact settings-card span-12">
        <p className="eyebrow">Settings</p>
        <h2>Week shape</h2>
        <label className="toggle-row"><span>Include Saturday</span><input type="checkbox" checked={settings.includeSaturday} onChange={(e) => onChange({ ...settings, includeSaturday: e.target.checked })} /></label>
        <label className="toggle-row"><span>Include Sunday</span><input type="checkbox" checked={settings.includeSunday} onChange={(e) => onChange({ ...settings, includeSunday: e.target.checked })} /></label>
      </article>
      <article className="card compact span-12">
        <h2>Delete Tasks</h2>
        <div className="task-list settings-task-list">
          {tasks.map((task) => (
            <div className="task-item settings-task-item" key={task._id}>
              <span>{task.title}</span>
              <button className="icon-button" onClick={() => onRemoveTask(task._id)} aria-label={`Remove ${task.title}`}><Trash2 size={17} /></button>
            </div>
          ))}
        </div>
      </article>
    </motion.section>
  );
}

function HelpPage() {
  return (
    <motion.section className="page-grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <article className="card help-card span-12">
        <p className="eyebrow">Help</p>
        <h1>How to decide daily tasks</h1>
        <p className="help-purpose">This is not a normal todo app. It is a repeated task system.</p>
        <p className="help-lede">Do not list every responsibility. Choose the few daily actions that protect your life and move it forward.</p>
      </article>
      <article className="card help-card span-12">
        <p className="eyebrow">Choose tasks</p>
        <h2>What belongs here?</h2>
        <p>Pick tasks that protect your baseline or create compounding change. If everything feels important, ask: what would change my life if I repeated it every day?</p>
        <ol className="help-priority-list">
          <li><span><strong>Stability:</strong> food, sleep, hygiene, movement, cleaning, medication, money.</span></li>
          <li><span><strong>Growth:</strong> study, work, skills, fitness, health, relationships.</span></li>
          <li><span><strong>Weak spot:</strong> the thing you keep avoiding or forgetting.</span></li>
          <li><span><strong>Minimum proof:</strong> the smallest version that still counts.</span></li>
        </ol>
      </article>
      <article className="card help-card span-12">
        <p className="eyebrow">Formula</p>
        <h2>Use this filter</h2>
        <div className="help-formula" aria-label="Daily task formula">
          <span>What you need to do every day</span>
          <b>+</b>
          <span>What will change your life</span>
          <b>+</b>
          <span>What you ideally want to do</span>
          <b>+</b>
          <span>What you should already be doing</span>
        </div>
        <p className="help-note">Your task list should come from the overlap. These are the actions that keep life stable and move it forward.</p>
      </article>
      <article className="card help-card span-12">
        <p className="eyebrow">Rules</p>
        <h2>Make tasks easy to repeat</h2>
        <div className="help-principle-grid">
          <div><strong>Small</strong><span>Make it possible on a bad day.</span></div>
          <div><strong>Flexible</strong><span>Avoid fragile times like 7 AM or 9 PM.</span></div>
          <div><strong>Category-based</strong><span>A task can stand for a useful category, like cleaning or movement.</span></div>
          <div><strong>Checklist-first</strong><span>If these few things happen, today still counts.</span></div>
        </div>
        <p className="help-note">Aim for 4 to 6 must-do items. They should matter, but they must be doable.</p>
      </article>
      <article className="card help-card span-12">
        <p className="eyebrow">Anchor task</p>
        <h2>Pick one non-negotiable</h2>
        <p>Your anchor is the one task you protect when the day falls apart.</p>
        <p className="help-note">Choose the task that gives structure, restores direction, or proves you did not abandon the system.</p>
      </article>
      <article className="card help-card span-12">
        <p className="eyebrow">Examples</p>
        <h2>Good tasks can look small</h2>
        <div className="help-example-grid">
          <div><strong>Cleaning</strong><span>Do one thing that makes your space easier to live in.</span></div>
          <div><strong>Call a person</strong><span>Rotate through family, friends, or old connections.</span></div>
          <div><strong>Meditate</strong><span>Shorten the session on a rough day. Do not break the chain.</span></div>
          <div><strong>NoPorn</strong><span>Keep a daily boundary that protects attention and self-control.</span></div>
          <div><strong>Meals</strong><span>Track meals in the way that makes eating reliably easier.</span></div>
        </div>
      </article>
      <article className="card help-card span-12">
        <p className="eyebrow">When it fails</p>
        <h2>Modify the system</h2>
        <p>If a task is missed often, treat it as data. The task may be too big, too vague, too rigid, or not honest enough.</p>
        <ul className="help-list compact-help-list">
          <li><strong>Too big:</strong> make the minimum version smaller.</li>
          <li><strong>Too vague:</strong> rename it so you know what counts as done.</li>
          <li><strong>Too rigid:</strong> make it movable.</li>
          <li><strong>Too fake:</strong> replace it with the real behavior you need.</li>
        </ul>
      </article>
    </motion.section>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings>(MOCK_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [tab, setTab] = useState<Tab>('today');
  const [resetReturnTab, setResetReturnTab] = useState<Exclude<Tab, 'reset'>>('today');
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [autoResetOpened, setAutoResetOpened] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [demoStepIndex, setDemoStepIndex] = useState(0);

  function openReset(returnTab: Exclude<Tab, 'reset'>) {
    setResetReturnTab(returnTab);
    setTab('reset');
  }

  async function saveSettings(next: Settings) {
    if (demo || !user) {
      setSettings(next);
      return;
    }
    const previous = settings;
    setSettings(next);
    void api<{ settings: Settings }>('/api/settings', { method: 'PATCH', ...jsonBody(next) })
      .then((data) => setSettings(data.settings))
      .catch(() => setSettings(previous));
  }

  useEffect(() => {
    Promise.all([api<{ user: User }>('/api/auth/me'), api<{ settings: Settings }>('/api/settings')])
      .then(([auth, sd]) => { setUser(auth.user); setSettings(sd.settings); setDemo(false); })
      .catch(() => {
        setUser(null);
        setDemo(false);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || !user || autoResetOpened) return;
    const loadStats = demo ? Promise.resolve(MOCK_STATS) : api<StatsPayload>('/api/stats');
    loadStats
      .then((stats) => {
        if (!hasTwoWeekDrop(stats.weekly)) return;
        setAutoResetOpened(true);
        openReset('today');
      })
      .catch(() => undefined);
  }, [autoResetOpened, demo, loading, user]);

  const isDemoTour = !user && !showAuth;
  const activeDemoStep = DEMO_STEPS[demoStepIndex];
  const effectiveDemo = demo || isDemoTour;
  const displayUser = user || MOCK_USER;

  useEffect(() => {
    if (!isDemoTour) return;
    setTab(activeDemoStep.tab);
  }, [activeDemoStep.tab, isDemoTour]);

  useEffect(() => {
    if (!isDemoTour) return;
    const timeoutId = window.setTimeout(() => {
      const target = document.querySelector(demoTargetSelector(activeDemoStep.focus));
      target?.scrollIntoView({ behavior: 'smooth', block: activeDemoStep.focus === 'tabs' ? 'end' : 'center' });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [activeDemoStep.focus, activeDemoStep.tab, isDemoTour]);

  function previousDemoStep() {
    const previousIndex = Math.max(0, demoStepIndex - 1);
    setDemoStepIndex(previousIndex);
    setTab(DEMO_STEPS[previousIndex].tab);
  }

  function nextDemoStep() {
    if (demoStepIndex >= DEMO_STEPS.length - 1) {
      setShowAuth(true);
      return;
    }
    const nextIndex = demoStepIndex + 1;
    setDemoStepIndex(nextIndex);
    setTab(DEMO_STEPS[nextIndex].tab);
  }

  async function removeTaskFromSettings(taskId: string) {
    setTasks((previous) => previous.filter((task) => task._id !== taskId));
    if (settings.anchorTaskId === taskId) setSettings((current) => ({ ...current, anchorTaskId: null }));
    if (!demo) await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
  }

  const content = useMemo(() => {
    if (tab === 'today') return <TodayPage demo={effectiveDemo} tasks={tasks} settings={settings} setTasks={setTasks} onChangeSettings={saveSettings} onOpenHelp={() => setTab('help')} onOpenMessUp={() => openReset('today')} />;
    if (tab === 'goals') return <GoalsPage demo={effectiveDemo} demoOpenGoal={isDemoTour && activeDemoStep.focus === 'goalDetail'} onOpenMessUp={() => openReset('goals')} />;
    if (tab === 'deadlines') return <DeadlinesPage demo={effectiveDemo} />;
    if (tab === 'stats') return <StatsPage demo={effectiveDemo} />;
    if (tab === 'help') return <HelpPage />;
    if (tab === 'reset') return <MessUpPage onBack={() => setTab(resetReturnTab)} />;
    return <SettingsPage settings={settings} tasks={tasks} onChange={(next) => void saveSettings(next)} onRemoveTask={(taskId) => void removeTaskFromSettings(taskId)} />;
  }, [settings, tasks, tab, effectiveDemo, resetReturnTab, isDemoTour, activeDemoStep.focus]);

  async function logout() {
    if (user && !demo) await api('/api/auth/logout', { method: 'POST' });
    setAutoResetOpened(false);
    setShowAuth(false);
    setUser(null); setDemo(false);
  }

  if (loading) return <div className="boot-screen">Executive Engine</div>;
  if (!user && showAuth) return <Login onAuth={setUser} initialMode="signup" />;

  return (
    <div className={`app-shell ${isDemoTour ? `is-demo-tour demo-focus-${activeDemoStep.focus}` : ''}`.trim()}>
      {(demo || isDemoTour) && <DemoBanner />}
      <header className="topbar">
        <div><p className="eyebrow">Executive Engine</p><strong>Hi, {displayUser.displayName}</strong></div>
        <div className="topbar-actions">
          <button className={`icon-button ${tab === 'help' ? 'is-active' : ''}`} onClick={() => setTab('help')} aria-label="Help"><HelpCircle size={18} /></button>
          <button className={`icon-button ${tab === 'settings' ? 'is-active' : ''}`} onClick={() => setTab('settings')} aria-label="Settings"><Settings2 size={18} /></button>
          <button className="icon-button" onClick={() => void logout()} aria-label="Log out"><LogOut size={18} /></button>
        </div>
      </header>
      <AnimatePresence mode="wait">{content}</AnimatePresence>
      <nav className="tabbar glass-panel">
        <TabButton active={tab === 'today'} onClick={() => setTab('today')} icon={<Home size={19} />} label="Today" />
        <TabButton active={tab === 'goals'} onClick={() => setTab('goals')} icon={<GoalIcon size={19} />} label="Goals" />
        <TabButton active={tab === 'deadlines'} onClick={() => setTab('deadlines')} icon={<CalendarClock size={19} />} label="Deadlines" />
        <TabButton active={tab === 'stats'} onClick={() => setTab('stats')} icon={<BarChart3 size={19} />} label="Stats" />
      </nav>
      {isDemoTour && <DemoCloud step={activeDemoStep} stepIndex={demoStepIndex} onBack={previousDemoStep} onNext={nextDemoStep} onSkip={() => setShowAuth(true)} />}
    </div>
  );
}

function TabButton({ active, icon, label, onClick, iconOnly = false }: { active: boolean; icon: React.ReactNode; label?: string; onClick: () => void; iconOnly?: boolean }) {
  return (
    <button className={`${active ? 'active' : ''} ${iconOnly ? 'icon-only' : ''}`.trim()} onClick={onClick} aria-label={label || 'Settings'}>
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
