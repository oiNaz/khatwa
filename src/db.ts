import Dexie, { type EntityTable } from 'dexie'
import type { AchievementUnlock, AppSettings, FocusSession, Task } from './types'
import { nextOccurrenceDate } from './domain'

class DaymarkDatabase extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  sessions!: EntityTable<FocusSession, 'id'>
  settings!: EntityTable<AppSettings, 'id'>
  achievements!: EntityTable<AchievementUnlock, 'id'>

  constructor() {
    super('daymark-local')
    this.version(1).stores({
      tasks: 'id, status, priority, dueAt, updatedAt, archivedAt, deletedAt, sample',
      sessions: 'id, taskId, status, createdAt, completedAt',
      settings: 'id',
    })
    this.version(2).stores({
      tasks: 'id, status, priority, dueAt, updatedAt, archivedAt, deletedAt, sample',
      sessions: 'id, taskId, status, createdAt, completedAt',
      settings: 'id',
    }).upgrade(async (transaction) => {
      await transaction.table('tasks').toCollection().modify((task: Task) => {
        task.subtasks ??= []
      })
    })
    this.version(3).stores({
      tasks: 'id, status, priority, dueAt, updatedAt, archivedAt, deletedAt, sample',
      sessions: 'id, taskId, status, createdAt, completedAt',
      settings: 'id',
      achievements: 'id, unlockedAt',
    })
    this.version(4).stores({
      tasks: 'id, status, priority, dueAt, updatedAt, archivedAt, deletedAt',
      sessions: 'id, taskId, status, createdAt, completedAt',
      settings: 'id',
      achievements: 'id, unlockedAt',
    }).upgrade(async (transaction) => {
      const tasks = transaction.table('tasks')
      const sampleTasks = await tasks.filter((task: Task) => task.sample).toArray()
      const sampleTaskIds = sampleTasks.map((task: Task) => task.id)

      if (sampleTaskIds.length) {
        await transaction.table('sessions').where('taskId').anyOf(sampleTaskIds).delete()
        await tasks.bulkDelete(sampleTaskIds)
      }
    })
    this.on('versionchange', () => this.close())
  }
}

export const db = new DaymarkDatabase()

export const defaultSettings: AppSettings = {
  id: 'preferences',
  theme: 'dark',
  language: 'en',
  dailyFocusMinutes: 120,
  defaultFocusMinutes: 25,
  notificationsEnabled: false,
  updatedAt: Date.now(),
}

export async function saveTask(task: Task): Promise<void> {
  const now = Date.now()
  const updated = {
    ...task,
    subtasks: task.subtasks ?? [],
    completedAt: task.status === 'done' ? (task.completedAt ?? now) : null,
    updatedAt: now,
  }
  await db.transaction('rw', db.tasks, async () => {
    const previous = await db.tasks.get(task.id)
    await db.tasks.put(updated)
    if (previous?.status !== 'done' && updated.status === 'done' && updated.recurrence !== 'none' && updated.dueAt) {
      const nextDate = nextOccurrenceDate(updated.dueAt, updated.recurrence)
      const nextId = `${updated.id}-${nextDate}`
      if (!(await db.tasks.get(nextId))) {
        await db.tasks.add({
          ...updated,
          id: nextId,
          subtasks: updated.subtasks.map((subtask) => ({ ...subtask, completed: false })),
          status: 'todo',
          dueAt: nextDate,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          archivedAt: null,
          deletedAt: null,
        })
      }
    }
  })
}

export async function transitionTask(task: Task, status: Task['status']): Promise<void> {
  const now = Date.now()
  const updated = {
    ...task,
    status,
    updatedAt: now,
    completedAt: status === 'done' ? (task.completedAt ?? now) : null,
  }
  await saveTask(updated)
}

export async function createFocusSession(taskId: string, plannedSeconds: number): Promise<FocusSession> {
  return db.transaction('rw', db.sessions, async () => {
    const existing = await db.sessions.where('status').anyOf('running', 'paused').first()
    if (existing) throw new Error('Finish or cancel the current focus session before starting another.')
    const session: FocusSession = {
      id: crypto.randomUUID(),
      taskId,
      status: 'running',
      plannedSeconds,
      elapsedSeconds: 0,
      startedAt: Date.now(),
      createdAt: Date.now(),
      completedAt: null,
    }
    await db.sessions.add(session)
    return session
  })
}

export async function updateSession(session: FocusSession): Promise<void> {
  await db.sessions.put(session)
}
