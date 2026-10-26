import type { MessageKey } from './i18n'
import type { AchievementUnlock, FocusSession, Task } from './types'

type AchievementMetric = 'createdTasks' | 'completedTasks' | 'focusSessions' | 'focusMinutes' | 'completedSubtasks' | 'bestDay'

export interface AchievementDefinition {
  id: string
  titleKey: MessageKey
  descriptionKey: MessageKey
  metric: AchievementMetric
  target: number
}

export const achievements: AchievementDefinition[] = [
  { id: 'first-task', titleKey: 'achievementFirstTaskTitle', descriptionKey: 'achievementFirstTaskDescription', metric: 'createdTasks', target: 1 },
  { id: 'tasks-5', titleKey: 'achievementTasks5Title', descriptionKey: 'achievementTasks5Description', metric: 'createdTasks', target: 5 },
  { id: 'tasks-10', titleKey: 'achievementTasks10Title', descriptionKey: 'achievementTasks10Description', metric: 'createdTasks', target: 10 },
  { id: 'tasks-25', titleKey: 'achievementTasks25Title', descriptionKey: 'achievementTasks25Description', metric: 'createdTasks', target: 25 },
  { id: 'tasks-50', titleKey: 'achievementTasks50Title', descriptionKey: 'achievementTasks50Description', metric: 'createdTasks', target: 50 },
  { id: 'tasks-100', titleKey: 'achievementTasks100Title', descriptionKey: 'achievementTasks100Description', metric: 'createdTasks', target: 100 },
  { id: 'first-completion', titleKey: 'achievementFirstCompletionTitle', descriptionKey: 'achievementFirstCompletionDescription', metric: 'completedTasks', target: 1 },
  { id: 'completed-2', titleKey: 'achievementCompleted2Title', descriptionKey: 'achievementCompleted2Description', metric: 'completedTasks', target: 2 },
  { id: 'completed-5', titleKey: 'achievementCompleted5Title', descriptionKey: 'achievementCompleted5Description', metric: 'completedTasks', target: 5 },
  { id: 'completed-10', titleKey: 'achievementCompleted10Title', descriptionKey: 'achievementCompleted10Description', metric: 'completedTasks', target: 10 },
  { id: 'completed-25', titleKey: 'achievementCompleted25Title', descriptionKey: 'achievementCompleted25Description', metric: 'completedTasks', target: 25 },
  { id: 'completed-50', titleKey: 'achievementCompleted50Title', descriptionKey: 'achievementCompleted50Description', metric: 'completedTasks', target: 50 },
  { id: 'completed-75', titleKey: 'achievementCompleted75Title', descriptionKey: 'achievementCompleted75Description', metric: 'completedTasks', target: 75 },
  { id: 'completed-100', titleKey: 'achievementCompleted100Title', descriptionKey: 'achievementCompleted100Description', metric: 'completedTasks', target: 100 },
  { id: 'completed-250', titleKey: 'achievementCompleted250Title', descriptionKey: 'achievementCompleted250Description', metric: 'completedTasks', target: 250 },
  { id: 'focus-first', titleKey: 'achievementFocus1Title', descriptionKey: 'achievementFocus1Description', metric: 'focusSessions', target: 1 },
  { id: 'focus-5', titleKey: 'achievementFocus5Title', descriptionKey: 'achievementFocus5Description', metric: 'focusSessions', target: 5 },
  { id: 'focus-10', titleKey: 'achievementFocus10Title', descriptionKey: 'achievementFocus10Description', metric: 'focusSessions', target: 10 },
  { id: 'focus-25', titleKey: 'achievementFocus25Title', descriptionKey: 'achievementFocus25Description', metric: 'focusSessions', target: 25 },
  { id: 'focus-50', titleKey: 'achievementFocus50Title', descriptionKey: 'achievementFocus50Description', metric: 'focusSessions', target: 50 },
  { id: 'focus-100', titleKey: 'achievementFocus100Title', descriptionKey: 'achievementFocus100Description', metric: 'focusSessions', target: 100 },
  { id: 'focus-hours-1', titleKey: 'achievementFocusHours1Title', descriptionKey: 'achievementFocusHours1Description', metric: 'focusMinutes', target: 60 },
  { id: 'focus-hours-5', titleKey: 'achievementFocusHours5Title', descriptionKey: 'achievementFocusHours5Description', metric: 'focusMinutes', target: 300 },
  { id: 'focus-hours-10', titleKey: 'achievementFocusHours10Title', descriptionKey: 'achievementFocusHours10Description', metric: 'focusMinutes', target: 600 },
  { id: 'focus-hours-25', titleKey: 'achievementFocusHours25Title', descriptionKey: 'achievementFocusHours25Description', metric: 'focusMinutes', target: 1500 },
  { id: 'focus-hours-50', titleKey: 'achievementFocusHours50Title', descriptionKey: 'achievementFocusHours50Description', metric: 'focusMinutes', target: 3000 },
  { id: 'subtasks-1', titleKey: 'achievementSubtasks1Title', descriptionKey: 'achievementSubtasks1Description', metric: 'completedSubtasks', target: 1 },
  { id: 'subtasks-10', titleKey: 'achievementSubtasks10Title', descriptionKey: 'achievementSubtasks10Description', metric: 'completedSubtasks', target: 10 },
  { id: 'subtasks-25', titleKey: 'achievementSubtasks25Title', descriptionKey: 'achievementSubtasks25Description', metric: 'completedSubtasks', target: 25 },
  { id: 'subtasks-50', titleKey: 'achievementSubtasks50Title', descriptionKey: 'achievementSubtasks50Description', metric: 'completedSubtasks', target: 50 },
  { id: 'subtasks-100', titleKey: 'achievementSubtasks100Title', descriptionKey: 'achievementSubtasks100Description', metric: 'completedSubtasks', target: 100 },
  { id: 'big-day-3', titleKey: 'achievementBigDay3Title', descriptionKey: 'achievementBigDay3Description', metric: 'bestDay', target: 3 },
  { id: 'big-day', titleKey: 'achievementBigDayTitle', descriptionKey: 'achievementBigDayDescription', metric: 'bestDay', target: 5 },
  { id: 'big-day-10', titleKey: 'achievementBigDay10Title', descriptionKey: 'achievementBigDay10Description', metric: 'bestDay', target: 10 },
]

export function getAchievementProgress(tasks: Task[], sessions: FocusSession[]): Record<string, number> {
  const userTasks = tasks.filter((task) => !task.sample)
  const taskIds = new Set(userTasks.map((task) => task.id))
  const completedTasks = userTasks.filter((task) => task.status === 'done' || task.completedAt !== null)
  const completedSessions = sessions.filter((session) => session.status === 'completed' && taskIds.has(session.taskId))
  const completedPerDay = new Map<string, number>()

  for (const task of completedTasks) {
    if (task.completedAt === null) continue
    const date = new Date(task.completedAt)
    const day = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
    completedPerDay.set(day, (completedPerDay.get(day) ?? 0) + 1)
  }

  const metrics: Record<AchievementMetric, number> = {
    createdTasks: userTasks.length,
    completedTasks: completedTasks.length,
    focusSessions: completedSessions.length,
    focusMinutes: Math.floor(completedSessions.reduce((total, session) => total + session.elapsedSeconds, 0) / 60),
    completedSubtasks: userTasks.reduce((total, task) => total + (task.subtasks ?? []).filter((subtask) => subtask.completed).length, 0),
    bestDay: Math.max(0, ...completedPerDay.values()),
  }

  return Object.fromEntries(achievements.map((achievement) => [achievement.id, metrics[achievement.metric]]))
}

export function newlyUnlockedAchievements(
  tasks: Task[],
  sessions: FocusSession[],
  unlocked: AchievementUnlock[],
): AchievementDefinition[] {
  const progress = getAchievementProgress(tasks, sessions)
  const unlockedIds = new Set(unlocked.map((achievement) => achievement.id))
  return achievements.filter((achievement) => progress[achievement.id] >= achievement.target && !unlockedIds.has(achievement.id))
}
