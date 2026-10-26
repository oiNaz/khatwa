import { describe, expect, it } from 'vitest'
import { achievements, getAchievementProgress, newlyUnlockedAchievements } from './achievements'
import type { FocusSession, Task } from './types'

const makeTask = (id: string, overrides: Partial<Task> = {}): Task => ({
  id, title: id, description: '', status: 'todo', priority: 'medium', category: '', dueAt: null,
  estimateMinutes: null, recurrence: 'none', subtasks: [], createdAt: 1, updatedAt: 1,
  completedAt: null, archivedAt: null, deletedAt: null, sample: false, ...overrides,
})

describe('achievement progress', () => {
  it('defines a unique set of milestones', () => {
    expect(achievements).toHaveLength(34)
    expect(new Set(achievements.map((achievement) => achievement.id)).size).toBe(achievements.length)
  })

  it('excludes sample records and counts completed work and focus time', () => {
    const tasks = [
      makeTask('done-1', { status: 'done', completedAt: new Date(2025, 0, 1).getTime(), subtasks: [{ id: 's1', title: 'step', completed: true }] }),
      makeTask('done-2', { status: 'done', completedAt: new Date(2025, 0, 1).getTime() }),
      makeTask('sample', { sample: true, status: 'done', completedAt: 1 }),
    ]
    const sessions: FocusSession[] = [
      { id: 'focus-1', taskId: 'done-1', status: 'completed', plannedSeconds: 1500, elapsedSeconds: 1800, startedAt: null, createdAt: 1, completedAt: 2 },
      { id: 'sample-focus', taskId: 'sample', status: 'completed', plannedSeconds: 1500, elapsedSeconds: 1500, startedAt: null, createdAt: 1, completedAt: 2 },
    ]

    const progress = getAchievementProgress(tasks, sessions)
    expect(progress['first-task']).toBe(2)
    expect(progress['first-completion']).toBe(2)
    expect(progress['focus-first']).toBe(1)
    expect(progress['subtasks-10']).toBe(1)
    expect(progress['big-day']).toBe(2)
  })

  it('unlocks earned achievements only once', () => {
    const tasks = [makeTask('task-1')]
    expect(newlyUnlockedAchievements(tasks, [], []).map((achievement) => achievement.id)).toContain('first-task')
    expect(newlyUnlockedAchievements(tasks, [], [{ id: 'first-task', unlockedAt: 10 }]).map((achievement) => achievement.id)).not.toContain('first-task')
  })
})
