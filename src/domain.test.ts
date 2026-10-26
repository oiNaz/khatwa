import { describe, expect, it } from 'vitest'
import { backupSchema, elapsedSeconds, exportData, nextOccurrenceDate, removeSampleRecords } from './domain'
import type { FocusSession, Task } from './types'

const task: Task = {
  id: 'task-1', title: 'Write tests', description: '', status: 'todo', priority: 'medium',
  category: '', dueAt: null, estimateMinutes: null, recurrence: 'none', subtasks: [], createdAt: 1,
  updatedAt: 1, completedAt: null, archivedAt: null, deletedAt: null, sample: false,
}

describe('focus elapsed time', () => {
  it('adds the current running interval to persisted elapsed time', () => {
    const session: FocusSession = { id: 's1', taskId: task.id, status: 'running', plannedSeconds: 1200, elapsedSeconds: 60, startedAt: 10_000, createdAt: 0, completedAt: null }
    expect(elapsedSeconds(session, 15_500)).toBe(65)
  })

  it('does not add paused time or negative clock differences', () => {
    const session: FocusSession = { id: 's1', taskId: task.id, status: 'paused', plannedSeconds: 1200, elapsedSeconds: 60, startedAt: null, createdAt: 0, completedAt: null }
    expect(elapsedSeconds(session, 15_500)).toBe(60)
    expect(elapsedSeconds({ ...session, status: 'running', startedAt: 20_000 }, 15_500)).toBe(60)
  })
})

describe('backup validation', () => {
  it('round-trips an export with all records', () => {
    const session: FocusSession = { id: 'focus-1', taskId: task.id, status: 'completed', plannedSeconds: 1500, elapsedSeconds: 1470, startedAt: null, createdAt: 1, completedAt: 2 }
    const achievement = { id: 'first-task', unlockedAt: 3 }
    const settings = { id: 'preferences' as const, theme: 'dark' as const, language: 'ar' as const, dailyFocusMinutes: 120, defaultFocusMinutes: 25, notificationsEnabled: false, updatedAt: 1 }
    const backup = exportData([task], [session], settings, [achievement])
    const restored = backupSchema.parse(JSON.parse(JSON.stringify(backup)))
    expect(restored.tasks).toEqual([task])
    expect(restored.sessions).toEqual([session])
    expect(restored.achievements).toEqual([achievement])
    expect(restored.settings).toEqual(settings)
    expect(restored.schemaVersion).toBe(2)
  })

  it('imports version 1 backups without achievement history', () => {
    const backup = exportData([task], [], { id: 'preferences', theme: 'dark', language: 'en', dailyFocusMinutes: 120, defaultFocusMinutes: 25, notificationsEnabled: false, updatedAt: 1 })
    const { achievements, ...versionOneBackup } = backup
    void achievements
    expect(backupSchema.parse({ ...versionOneBackup, schemaVersion: 1 }).achievements).toEqual([])
  })

  it('removes legacy demo tasks and orphaned focus sessions from exports and imports', () => {
    const demoTask = { ...task, id: 'legacy-demo', sample: true }
    const demoSession: FocusSession = { id: 'legacy-focus', taskId: demoTask.id, status: 'completed', plannedSeconds: 1500, elapsedSeconds: 1500, startedAt: null, createdAt: 1, completedAt: 2 }
    const regularSession: FocusSession = { ...demoSession, id: 'focus-1', taskId: task.id }
    const orphanedSession: FocusSession = { ...demoSession, id: 'orphaned-focus', taskId: 'missing-task' }
    const records = removeSampleRecords([task, demoTask], [regularSession, demoSession, orphanedSession])
    expect(records.tasks.map((item) => item.id)).toEqual([task.id])
    expect(records.sessions.map((item) => item.id)).toEqual(['focus-1'])

    const backup = exportData([task, demoTask], [regularSession, demoSession, orphanedSession], { id: 'preferences', theme: 'dark', language: 'en', dailyFocusMinutes: 120, defaultFocusMinutes: 25, notificationsEnabled: false, updatedAt: 1 })
    expect(backup.tasks.map((item) => item.id)).toEqual([task.id])
    expect(backup.sessions.map((item) => item.id)).toEqual(['focus-1'])
  })

  it('imports older backups without subtasks as tasks with no steps', () => {
    const backup = exportData([{ ...task, subtasks: [{ id: 'step-1', title: 'Prepare outline', completed: true }] }], [], { id: 'preferences', theme: 'dark', language: 'en', dailyFocusMinutes: 120, defaultFocusMinutes: 25, notificationsEnabled: false, updatedAt: 1 })
    const legacyBackup = { ...backup, tasks: backup.tasks.map((task) => {
      const { subtasks, ...legacyTask } = task
      void subtasks
      return legacyTask
    }) }
    expect(backupSchema.parse(legacyBackup).tasks[0].subtasks).toEqual([])
  })

  it('validates and preserves subtask progress in backups', () => {
    const backup = exportData([{ ...task, subtasks: [{ id: 'step-1', title: 'Prepare outline', completed: true }] }], [], { id: 'preferences', theme: 'dark', language: 'en', dailyFocusMinutes: 120, defaultFocusMinutes: 25, notificationsEnabled: false, updatedAt: 1 })
    expect(backupSchema.parse(backup).tasks[0].subtasks[0].completed).toBe(true)
    expect(backupSchema.safeParse({ ...backup, tasks: [{ ...backup.tasks[0], subtasks: Array.from({ length: 51 }, (_, index) => ({ id: `step-${index}`, title: `Step ${index}`, completed: false })) }] }).success).toBe(false)
  })

  describe('recurrence dates', () => {
    it('clamps monthly dates at month boundaries and leap years', () => {
      expect(nextOccurrenceDate('2025-01-31', 'monthly')).toBe('2025-02-28')
      expect(nextOccurrenceDate('2024-01-31', 'monthly')).toBe('2024-02-29')
    })
  })

  it('rejects sessions that reference missing tasks', () => {
    const backup = {
      ...exportData([], [], { id: 'preferences', theme: 'dark', language: 'en', dailyFocusMinutes: 120, defaultFocusMinutes: 25, notificationsEnabled: false, updatedAt: 1 }),
      sessions: [{ id: 's1', taskId: 'missing', status: 'completed' as const, plannedSeconds: 30, elapsedSeconds: 30, startedAt: null, createdAt: 1, completedAt: 2 }],
    }
    expect(backupSchema.safeParse(backup).success).toBe(false)
  })

  it('rejects malformed local due dates', () => {
    const backup = exportData([{ ...task, dueAt: '2025-02-31' }], [], { id: 'preferences', theme: 'dark', language: 'en', dailyFocusMinutes: 120, defaultFocusMinutes: 25, notificationsEnabled: false, updatedAt: 1 })
    expect(backupSchema.safeParse(backup).success).toBe(false)
  })
})
