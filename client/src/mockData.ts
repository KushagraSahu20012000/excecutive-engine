import type { Deadline, Goal, Settings, Task, User } from './types';

export const MOCK_USER: User = {
  id: 'demo',
  email: 'demo@executive.engine',
  displayName: 'Demo User',
  avatarUrl: undefined
};

export const MOCK_SETTINGS: Settings = {
  includeSaturday: false,
  includeSunday: false
};

export const MOCK_TASKS: Task[] = [
  { _id: 't1', title: 'Morning deep work block', position: 0 },
  { _id: 't2', title: 'Review open commitments', position: 1 },
  { _id: 't3', title: 'Clear inbox to zero', position: 2 },
  { _id: 't4', title: '30-min physical reset', position: 3 }
];

export const MOCK_GOALS: Goal[] = [
  {
    _id: 'g1',
    title: 'Launch Executive Engine',
    description: 'Ship the first public version to 100 users.',
    deadlineAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    actions: [
      { _id: 'a1', title: 'Write README and setup docs' },
      { _id: 'a2', title: 'Test on real Android device' }
    ],
    notes: [
      { _id: 'n1', kind: 'works', body: 'Working in 2-hour deep focus blocks' },
      { _id: 'n2', kind: 'doesnt', body: 'Multitasking across tabs' }
    ],
    completions: [{ _id: 'c1', actionId: 'a1', date: new Date().toISOString().slice(0, 10) }]
  },
  {
    _id: 'g2',
    title: 'Build consistent sleep schedule',
    description: 'Lights out by 23:00, up by 07:00 for 30 consecutive days.',
    deadlineAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
    actions: [{ _id: 'a3', title: 'No screens after 22:30' }],
    notes: [{ _id: 'n3', kind: 'works', body: 'Blackout curtains' }],
    completions: []
  }
];

export const MOCK_DEADLINES: Deadline[] = [
  { _id: 'd1', title: 'Submit tax return', description: '', dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), outcome: 'pending' },
  { _id: 'd2', title: 'Renew domain subscription', description: '', dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), outcome: 'pending' },
  { _id: 'd3', title: 'Deliver design brief', description: 'Brand identity project', dueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), outcome: 'pass' }
];

export const MOCK_STATS = {
  weekly: [
    { label: 'Apr 27', percent: 40 },
    { label: 'May 4', percent: 60 },
    { label: 'May 11', percent: 55 },
    { label: 'May 18', percent: 80 },
    { label: 'May 25', percent: 72 },
    { label: 'Jun 1', percent: 90 },
    { label: 'Jun 8', percent: 85 },
    { label: 'Jun 15', percent: 95 }
  ],
  deadlineRatio: [
    { name: 'Passed', value: 7 },
    { name: 'Failed', value: 2 },
    { name: 'Pending', value: 3 }
  ],
  missedTasks: [
    { title: 'Review open commitments', missed: 9 },
    { title: '30-min physical reset', missed: 6 },
    { title: 'Clear inbox to zero', missed: 4 },
    { title: 'Morning deep work block', missed: 3 }
  ],
  deadlineLeadTime: [
    { label: '<1h', count: 1 },
    { label: '1-6h', count: 2 },
    { label: '6-24h', count: 1 },
    { label: '1-3d', count: 2 },
    { label: '3-7d', count: 1 },
    { label: '7d+', count: 0 }
  ],
  streak: 6
};
