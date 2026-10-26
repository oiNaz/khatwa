export type TaskStatus = 'todo' | 'in-progress' | 'done'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly'

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  category: string
  dueAt: string | null
  estimateMinutes: number | null
  recurrence: Recurrence
  subtasks: Subtask[]
  createdAt: number
  updatedAt: number
  completedAt: number | null
  archivedAt: number | null
  deletedAt: number | null
  sample: boolean
}

export interface FocusSession {
  id: string
  taskId: string
  status: 'running' | 'paused' | 'completed' | 'cancelled'
  plannedSeconds: number
  elapsedSeconds: number
  startedAt: number | null
  createdAt: number
  completedAt: number | null
}

export interface AchievementUnlock {
  id: string
  unlockedAt: number
}

export interface AppSettings {
  id: 'preferences'
  theme: 'dark' | 'light'
  language: 'en' | 'ar'
  dailyFocusMinutes: number
  defaultFocusMinutes: number
  notificationsEnabled: boolean
  updatedAt: number
}

export interface BackupFile {
  format: 'daymark-backup'
  schemaVersion: 1 | 2
  appVersion: string
  exportedAt: string
  tasks: Task[]
  sessions: FocusSession[]
  achievements: AchievementUnlock[]
  settings: AppSettings
}
