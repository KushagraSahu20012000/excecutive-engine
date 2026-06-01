export type User = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
};

export type Settings = {
  includeSaturday: boolean;
  includeSunday: boolean;
  anchorTaskId?: string | null;
  notificationsEnabled?: boolean;
};

export type Task = {
  _id: string;
  title: string;
  position: number;
};

export type Completion = {
  _id: string;
  taskId: string;
  date: string;
};

export type GoalAction = {
  _id: string;
  title: string;
  createdAt?: string;
};

export type GoalActionCompletion = {
  _id: string;
  actionId: string;
  date: string;
};

export type GoalNote = {
  _id: string;
  kind: 'works' | 'doesnt';
  body: string;
};

export type Goal = {
  _id: string;
  title: string;
  description: string;
  deadlineAt: string;
  actions: GoalAction[];
  notes: GoalNote[];
  completions: GoalActionCompletion[];
};

export type Deadline = {
  _id: string;
  title: string;
  description: string;
  dueAt: string;
  outcome: 'pending' | 'pass' | 'fail';
};