import { z } from 'zod'
import type { AchievementUnlock, BackupFile, FocusSession, Task } from './types'

const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  status: z.enum(['todo', 'in-progress', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.string(),
  dueAt: z.iso.date().nullable(),
  estimateMinutes: z.number().nullable(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']),
  subtasks: z.array(z.object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    completed: z.boolean(),
  })).max(50).default([]).superRefine((subtasks, context) => {
    const ids = new Set<string>()
    subtasks.forEach((subtask, index) => {
      if (ids.has(subtask.id)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Subtask IDs must be unique.', path: [index, 'id'] })
      ids.add(subtask.id)
    })
  }),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().nullable(),
  archivedAt: z.number().nullable(),
  deletedAt: z.number().nullable(),
  sample: z.boolean(),
})

const sessionSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  status: z.enum(['running', 'paused', 'completed', 'cancelled']),
  plannedSeconds: z.number().nonnegative(),
  elapsedSeconds: z.number().nonnegative(),
  startedAt: z.number().nullable(),
  createdAt: z.number(),
  completedAt: z.number().nullable(),
})

export const backupSchema = z.object({
  format: z.literal('daymark-backup'),
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  appVersion: z.string().min(1),
  exportedAt: z.string(),
  tasks: z.array(taskSchema),
  sessions: z.array(sessionSchema),
  achievements: z.array(z.object({
    id: z.string().min(1),
    unlockedAt: z.number(),
  })).default([]),
  settings: z.object({
    id: z.literal('preferences'),
    theme: z.enum(['dark', 'light']),
    language: z.enum(['en', 'ar']),
    dailyFocusMinutes: z.number().nonnegative(),
    defaultFocusMinutes: z.number().positive(),
    notificationsEnabled: z.boolean(),
    updatedAt: z.number(),
  }),
}).superRefine((backup, context) => {
  const ids = new Set(backup.tasks.map((task) => task.id))
  for (const session of backup.sessions) {
    if (!ids.has(session.taskId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Session ${session.id} references a missing task.` })
    }
  }
})

export function elapsedSeconds(session: FocusSession, now: number): number {
  const runningSeconds = session.status === 'running' && session.startedAt !== null
    ? Math.max(0, Math.floor((now - session.startedAt) / 1000))
    : 0
  return session.elapsedSeconds + runningSeconds
}

export function removeSampleRecords(tasks: Task[], sessions: FocusSession[]): { tasks: Task[]; sessions: FocusSession[] } {
  const remainingTasks = tasks.filter((task) => !task.sample)
  const remainingTaskIds = new Set(remainingTasks.map((task) => task.id))
  return {
    tasks: remainingTasks,
    sessions: sessions.filter((session) => remainingTaskIds.has(session.taskId)),
  }
}

export function nextOccurrenceDate(dueAt: string, recurrence: Exclude<Task['recurrence'], 'none'>): string {
  const [year, month, day] = dueAt.slice(0, 10).split('-').map(Number)
  const next = new Date(year, month - 1, day, 12)
  if (recurrence === 'daily') next.setDate(next.getDate() + 1)
  if (recurrence === 'weekly') next.setDate(next.getDate() + 7)
  if (recurrence === 'monthly') {
    const desiredDay = next.getDate()
    next.setDate(1)
    next.setMonth(next.getMonth() + 1)
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    next.setDate(Math.min(desiredDay, lastDay))
  }
  return `${next.getFullYear()}-${`${next.getMonth() + 1}`.padStart(2, '0')}-${`${next.getDate()}`.padStart(2, '0')}`
}

export function exportData(
  tasks: Task[],
  sessions: FocusSession[],
  settings: BackupFile['settings'],
  achievements: AchievementUnlock[] = [],
): BackupFile {
  const cleanRecords = removeSampleRecords(tasks, sessions)
  return { format: 'daymark-backup', schemaVersion: 2, appVersion: '1.0.0', exportedAt: new Date().toISOString(), ...cleanRecords, achievements, settings }
}
