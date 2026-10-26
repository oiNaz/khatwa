import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { liveQuery } from 'dexie'
import { useObservable } from 'dexie-react-hooks'
import {
  Archive, BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, Languages,
  Clock3, Download, Inbox, LayoutDashboard, ListTodo, LockKeyhole,
  Menu, Moon, Pause, Play, Plus, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Trophy,
  Square, Sun, Trash2, X,
} from 'lucide-react'
import { db, createFocusSession, defaultSettings, saveTask, transitionTask, updateSession } from './db'
import { backupSchema, elapsedSeconds, exportData, removeSampleRecords } from './domain'
import { translate, type Language, type MessageKey } from './i18n'
import { achievements as achievementDefinitions, getAchievementProgress, newlyUnlockedAchievements } from './achievements'
import { motivationalQuotes } from './motivations'
import type { AchievementUnlock, AppSettings, BackupFile, FocusSession, Priority, Recurrence, Subtask, Task, TaskStatus } from './types'

type Section = 'Today' | 'Inbox' | 'All Tasks' | 'Calendar' | 'Kanban' | 'Focus' | 'Analytics' | 'Achievements' | 'Settings' | 'Archive' | 'Trash'
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
type InstallPlatform = 'ios' | 'android' | 'other'
type AchievementCelebration = { count: number; title: string }

const installStateKey = 'khatwa-install-state'

const sections: { name: Section; icon: typeof LayoutDashboard; group: 'WORKSPACE' | 'MANAGE' }[] = [
  { name: 'Today', icon: LayoutDashboard, group: 'WORKSPACE' },
  { name: 'Inbox', icon: Inbox, group: 'WORKSPACE' },
  { name: 'All Tasks', icon: ListTodo, group: 'WORKSPACE' },
  { name: 'Calendar', icon: CalendarDays, group: 'WORKSPACE' },
  { name: 'Kanban', icon: Square, group: 'WORKSPACE' },
  { name: 'Focus', icon: Clock3, group: 'WORKSPACE' },
  { name: 'Analytics', icon: BarChart3, group: 'MANAGE' },
  { name: 'Achievements', icon: Trophy, group: 'MANAGE' },
  { name: 'Settings', icon: Settings2, group: 'MANAGE' },
  { name: 'Archive', icon: Archive, group: 'MANAGE' },
  { name: 'Trash', icon: Trash2, group: 'MANAGE' },
]
const todayKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const localDateInput = (value: string | null): string => value ? value.slice(0, 10) : ''
const formatDate = (value: string | null, language: Language = 'en'): string => {
  if (!value) return ''
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric' }).format(new Date(year, month - 1, day))
}
const formatDuration = (seconds: number, language: Language = 'en'): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return language === 'ar'
    ? hours ? `${hours.toLocaleString('ar')} س ${minutes.toLocaleString('ar')} د` : `${minutes.toLocaleString('ar')} د`
    : hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
const formatTimer = (seconds: number, language: Language = 'en'): string => {
  const safe = Math.max(0, seconds)
  const time = `${Math.floor(safe / 3600).toString().padStart(2, '0')}:${Math.floor((safe % 3600) / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`
  return language === 'ar' ? time.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]) : time
}
const uid = (): string => crypto.randomUUID()
const emptyTasks: Task[] = []
const emptySessions: FocusSession[] = []
const emptyAchievements: AchievementUnlock[] = []
const welcomeSeenKey = 'khatwa-welcome-seen'

function getWelcomeQuoteIndex(language: Language): number {
  const quotes = motivationalQuotes[language]
  const key = `khatwa-welcome-quote-${language}`
  try {
    const previousIndex = Number(window.localStorage.getItem(key))
    let nextIndex = Math.floor(Math.random() * quotes.length)
    if (quotes.length > 1 && nextIndex === previousIndex) nextIndex = (nextIndex + 1) % quotes.length
    window.localStorage.setItem(key, String(nextIndex))
    return nextIndex
  } catch (error) {
    console.warn('Could not remember the previous welcome quote.', error)
    return Math.floor(Math.random() * quotes.length)
  }
}

function blankTask(): Task {
  const now = Date.now()
  return {
    id: uid(), title: '', description: '', status: 'todo', priority: 'medium',
    category: '', dueAt: null, estimateMinutes: null, recurrence: 'none',
    subtasks: [],
    createdAt: now, updatedAt: now, completedAt: null, archivedAt: null,
    deletedAt: null, sample: false,
  }
}

function App() {
  const tasks = useObservable(() => liveQuery(() => db.tasks.toArray()), []) ?? emptyTasks
  const sessions = useObservable(() => liveQuery(() => db.sessions.toArray()), []) ?? emptySessions
  const settings = useObservable(() => liveQuery(async () => (await db.settings.get('preferences')) ?? defaultSettings), []) ?? defaultSettings
  const storedAchievements = useObservable(() => liveQuery(() => db.achievements.toArray()))
  const achievementRecords = storedAchievements ?? emptyAchievements
  const language = settings.language
  const locale = language === 'ar' ? 'ar' : 'en'
  const tr = useCallback((key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values), [language])
  const [section, setSection] = useState<Section>('Today')
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return window.localStorage.getItem(welcomeSeenKey) !== 'true'
    } catch (error) {
      console.warn('Could not read the welcome screen preference.', error)
      return true
    }
  })
  const [welcomeQuoteIndex] = useState(() => getWelcomeQuoteIndex(language))
  const [taskDialog, setTaskDialog] = useState<Task | null>(null)
  const [subtaskDrafts, setSubtaskDrafts] = useState<Subtask[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [installPromptEvent, setInstallPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [showInstallInvite, setShowInstallInvite] = useState(false)
  const [isAppInstalled, setIsAppInstalled] = useState(false)
  const [installHelpPlatform, setInstallHelpPlatform] = useState<InstallPlatform | null>(null)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [toast, setToast] = useState('')
  const [achievementCelebration, setAchievementCelebration] = useState<AchievementCelebration | null>(null)
  const [now, setNow] = useState(Date.now())
  const [calendarOffset, setCalendarOffset] = useState(0)
  const [focusTaskId, setFocusTaskId] = useState('')
  const [focusMinutes, setFocusMinutes] = useState(settings.defaultFocusMinutes)
  const [importInput, setImportInput] = useState<HTMLInputElement | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const installHelpCloseRef = useRef<HTMLButtonElement>(null)
  const dialogOpenerRef = useRef<HTMLElement | null>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const focusSearchOnSectionChange = useRef(false)
  const pendingAchievementIds = useRef(new Set<string>())
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishWelcome = () => {
    try {
      window.localStorage.setItem(welcomeSeenKey, 'true')
    } catch (error) {
      console.warn('Could not save the welcome screen preference.', error)
    }
    setShowWelcome(false)
  }
  const achievementProgress = useMemo(() => getAchievementProgress(tasks, sessions), [tasks, sessions])
  const unlockedAchievementIds = useMemo(() => new Set(achievementRecords.map((achievement) => achievement.id)), [achievementRecords])
  const unlockedAchievementCount = achievementDefinitions.filter((achievement) => unlockedAchievementIds.has(achievement.id)).length

  useEffect(() => {
    if (storedAchievements === undefined) return
    const newAchievements = newlyUnlockedAchievements(tasks, sessions, achievementRecords)
      .filter((achievement) => !pendingAchievementIds.current.has(achievement.id))
    if (!newAchievements.length) return
    const unlockedAt = Date.now()
    newAchievements.forEach((achievement) => pendingAchievementIds.current.add(achievement.id))
    void db.achievements.bulkPut(newAchievements.map(({ id }) => ({ id, unlockedAt })))
      .then(() => {
        newAchievements.forEach((achievement) => pendingAchievementIds.current.delete(achievement.id))
        if (celebrationTimer.current) clearTimeout(celebrationTimer.current)
        setAchievementCelebration({ count: newAchievements.length, title: translate(language, newAchievements[0].titleKey) })
        celebrationTimer.current = setTimeout(() => setAchievementCelebration(null), 5200)
      })
      .catch(() => {
        newAchievements.forEach((achievement) => pendingAchievementIds.current.delete(achievement.id))
        showToast(translate(language, 'achievementSaveFailed'))
      })
  }, [tasks, sessions, storedAchievements, achievementRecords, language])
  useEffect(() => () => {
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current)
  }, [])

  const openTaskDialog = useCallback((task: Task) => {
    dialogOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setMobileMenuOpen(false)
    setSubtaskDrafts(task.subtasks ?? [])
    setNewSubtaskTitle('')
    setTaskDialog(task)
  }, [])
  const closeTaskDialog = useCallback(() => {
    setTaskDialog(null)
    setSubtaskDrafts([])
    setNewSubtaskTitle('')
  }, [])
  const navigateToSection = useCallback((nextSection: Section) => {
    setSection(nextSection)
    setMobileMenuOpen(false)
  }, [])
  useEffect(() => {
    void db.settings.get('preferences').then((stored) => {
      if (!stored) return db.settings.put(defaultSettings)
      return undefined
    }).catch(() => showToast(tr('preferencesFailed')))
  }, [tr])

  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)')
    const isStandalone = () => standaloneQuery.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    const invitationHandled = () => {
      try {
        return window.localStorage.getItem(installStateKey) !== null
      } catch (error) {
        console.warn('Could not read the install invitation preference.', error)
        return false
      }
    }
    const markInstalled = () => {
      setIsAppInstalled(true)
      try {
        window.localStorage.setItem(installStateKey, 'installed')
      } catch (error) {
        console.warn('Could not save the installed app state.', error)
      }
      setShowInstallInvite(false)
      setInstallPromptEvent(null)
    }

    setIsAppInstalled(isStandalone())
    if (isStandalone()) markInstalled()

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPromptEvent(event as InstallPromptEvent)
      if (!invitationHandled()) setShowInstallInvite(true)
    }
    function onAppInstalled() {
      markInstalled()
    }
    function onDisplayModeChange(event: MediaQueryListEvent) {
      if (event.matches) markInstalled()
      else setIsAppInstalled(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    standaloneQuery.addEventListener('change', onDisplayModeChange)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
      standaloneQuery.removeEventListener('change', onDisplayModeChange)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  const dismissInstallInvite = (state = 'dismissed') => {
    try {
      window.localStorage.setItem(installStateKey, state)
    } catch (error) {
      console.warn('Could not save the install invitation preference.', error)
    }
    setShowInstallInvite(false)
  }

  const installApp = async () => {
    if (!installPromptEvent) {
      const userAgent = navigator.userAgent
      setInstallHelpPlatform(/iPhone|iPad|iPod/i.test(userAgent) ? 'ios' : /Android/i.test(userAgent) ? 'android' : 'other')
      return
    }
    try {
      await installPromptEvent.prompt()
      const choice = await installPromptEvent.userChoice
      dismissInstallInvite(choice.outcome === 'accepted' ? 'installed' : 'dismissed')
      if (choice.outcome === 'accepted') setIsAppInstalled(true)
      setInstallPromptEvent(null)
    } catch {
      showToast(tr('installFailed'))
    }
  }

  const activeSession = sessions.find((session) => session.status === 'running' || session.status === 'paused')
  const activeElapsed = activeSession ? elapsedSeconds(activeSession, now) : 0
  const completingSession = useRef<string | null>(null)

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running' || activeElapsed < activeSession.plannedSeconds || completingSession.current === activeSession.id) return
    completingSession.current = activeSession.id
    void updateSession({
      ...activeSession,
      status: 'completed',
      elapsedSeconds: activeElapsed,
      startedAt: null,
      completedAt: Date.now(),
    }).then(() => showToast(tr('sessionComplete')))
      .catch(() => {
        completingSession.current = null
        showToast(tr('sessionCompleteFailed'))
      })
  }, [activeSession, activeElapsed, tr])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        const target = event.target
        if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))) return
        event.preventDefault()
        openTaskDialog(blankTask())
      }
      if (event.key === 'Escape' && mobileMenuOpen) setMobileMenuOpen(false)
      if (event.key === 'Tab' && mobileMenuOpen) {
        const navigation = document.getElementById('app-navigation')
        const focusable = [...(navigation?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && (document.activeElement === first || !navigation?.contains(document.activeElement))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !navigation?.contains(document.activeElement))) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileMenuOpen, openTaskDialog])

  useLayoutEffect(() => {
    if (!mobileMenuOpen) return
    const previousOverflow = document.body.style.overflow
    const menuOpener = mobileMenuButtonRef.current
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      menuOpener?.focus()
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (!taskDialog) {
      const opener = dialogOpenerRef.current
      if (opener?.isConnected) opener.focus()
      dialogOpenerRef.current = null
      return
    }

    const dialog = dialogRef.current
    const firstField = dialog?.querySelector<HTMLElement>('input[name="title"]')
      ?? dialog?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select, button')
    firstField?.focus()

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeTaskDialog()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.getAttribute('aria-hidden') !== 'true')
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trapFocus)
    return () => document.removeEventListener('keydown', trapFocus)
  }, [taskDialog, closeTaskDialog])

  useEffect(() => {
    if (!installHelpPlatform) return
    installHelpCloseRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInstallHelpPlatform(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [installHelpPlatform])

  useEffect(() => {
    if (section === 'All Tasks' && focusSearchOnSectionChange.current) {
      searchInputRef.current?.focus()
      focusSearchOnSectionChange.current = false
    }
  }, [section])

  useEffect(() => {
    document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = settings.language
    document.documentElement.classList.toggle('light', settings.theme === 'light')
  }, [settings.language, settings.theme])

  const liveTasks = tasks.filter((task) => !task.deletedAt && !task.archivedAt)
  const activeTasks = liveTasks.filter((task) => task.status !== 'done')
  const todayTasks = activeTasks.filter((task) => task.dueAt && localDateInput(task.dueAt) <= todayKey(new Date()))
  const inboxTasks = activeTasks.filter((task) => !task.dueAt && !task.category)
  const completedToday = liveTasks.filter((task) => task.status === 'done' && task.completedAt && todayKey(new Date(task.completedAt)) === todayKey(new Date()))
  const categories = [...new Set(liveTasks.map((task) => task.category).filter(Boolean))]
  const focusToday = sessions.filter((session) => session.status === 'completed' && session.completedAt && todayKey(new Date(session.completedAt)) === todayKey(new Date())).reduce((total, session) => total + session.elapsedSeconds, 0)

  const filteredTasks = useMemo(() => tasks
    .filter((task) => section === 'Trash' ? Boolean(task.deletedAt) : section === 'Archive' ? Boolean(task.archivedAt) && !task.deletedAt : !task.deletedAt && !task.archivedAt)
    .filter((task) => section === 'Inbox' ? inboxTasks.some((item) => item.id === task.id) : true)
    .filter((task) => section === 'Today' ? todayTasks.some((item) => item.id === task.id) || (task.status === 'done' && task.completedAt && todayKey(new Date(task.completedAt)) === todayKey(new Date())) : true)
    .filter((task) => !search || `${task.title} ${task.description} ${task.category} ${(task.subtasks ?? []).map((subtask) => subtask.title).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
    .filter((task) => priorityFilter === 'all' || task.priority === priorityFilter)
    .filter((task) => statusFilter === 'all' || task.status === statusFilter)
    .filter((task) => categoryFilter === 'all' || task.category === categoryFilter)
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1
      if (b.status === 'done' && a.status !== 'done') return -1
      if (!a.dueAt) return b.dueAt ? 1 : b.createdAt - a.createdAt
      if (!b.dueAt) return -1
      return a.dueAt.localeCompare(b.dueAt)
    }), [tasks, section, inboxTasks, todayTasks, search, priorityFilter, statusFilter, categoryFilter])

  const saveSettings = async (updates: Partial<AppSettings>) => {
    try {
      await db.settings.put({ ...settings, ...updates, updatedAt: Date.now() })
      showToast(translate(updates.language ?? language, 'preferencesSaved'))
    } catch {
      showToast(translate(updates.language ?? language, 'preferencesFailed'))
    }
  }

  const toggleTheme = () => void saveSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })

  const submitTask = async (task: Task) => {
    if (!task.title.trim()) {
      showToast(tr('titleRequired'))
      return
    }
    const subtasks = subtaskDrafts
      .map((subtask) => ({ ...subtask, title: subtask.title.trim() }))
      .filter((subtask) => subtask.title)
    if (task.status === 'done') {
      const pending = subtasks.filter((subtask) => !subtask.completed)
      if (pending.length && !window.confirm(tr('completeWithSubtasks', { count: pending.length }))) return
      if (pending.length) subtasks.forEach((subtask) => { subtask.completed = true })
    }
    try {
      await saveTask({ ...task, title: task.title.trim(), dueAt: task.dueAt ? task.dueAt.slice(0, 10) : null, subtasks })
      closeTaskDialog()
      showToast(task.id && tasks.some((item) => item.id === task.id) ? tr('taskUpdated') : tr('taskAdded'))
    } catch {
      showToast(tr('taskSaveFailed'))
    }
  }

  const taskOperation = async (task: Task, operation: 'archive' | 'trash' | 'restore' | 'duplicate') => {
    try {
      if (operation === 'duplicate') {
        await saveTask({ ...task, id: uid(), title: `${task.title} (${language === 'ar' ? 'نسخة' : 'copy'})`, status: 'todo', subtasks: (task.subtasks ?? []).map((subtask) => ({ ...subtask, id: uid(), completed: false })), createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, archivedAt: null, deletedAt: null })
        showToast(tr('taskDuplicated'))
      } else if (operation === 'restore') {
        await saveTask({ ...task, archivedAt: null, deletedAt: null, updatedAt: Date.now() })
        showToast(tr('taskRestored'))
      } else {
        await saveTask({ ...task, archivedAt: operation === 'archive' ? Date.now() : task.archivedAt, deletedAt: operation === 'trash' ? Date.now() : task.deletedAt })
        showToast(operation === 'archive' ? tr('taskArchived') : tr('taskTrashed'))
      }
    } catch {
      showToast(tr('taskChangeFailed'))
    }
  }

  const permanentlyDeleteTask = async (task: Task) => {
    if (!window.confirm(tr('confirmDeleteTask', { title: task.title }))) return
    try {
      await db.transaction('rw', db.tasks, db.sessions, async () => {
        await db.sessions.where('taskId').equals(task.id).delete()
        await db.tasks.delete(task.id)
      })
      showToast(tr('taskDeleted'))
    } catch {
      showToast(tr('taskDeleteFailed'))
    }
  }

  const switchStatus = async (task: Task, status: TaskStatus) => {
    const pending = (task.subtasks ?? []).filter((subtask) => !subtask.completed)
    if (status === 'done' && pending.length) {
      if (!window.confirm(tr('completeWithSubtasks', { count: pending.length }))) return
      task = { ...task, subtasks: (task.subtasks ?? []).map((subtask) => ({ ...subtask, completed: true })) }
    }
    try { await transitionTask(task, status) } catch { showToast(tr('taskStatusFailed')) }
  }

  const startFocus = async () => {
    const chosenTask = activeTasks.find((task) => task.id === focusTaskId)
    if (!chosenTask) {
      showToast(activeTasks.length ? tr('focusTaskRequired') : tr('createTaskFirst'))
      return
    }
    try {
      await createFocusSession(chosenTask.id, Math.max(1, focusMinutes) * 60)
      setFocusTaskId(chosenTask.id)
      showToast(tr('focusStarted'))
    } catch (error) { showToast(error instanceof Error ? tr('sessionConflict') : tr('focusStartFailed')) }
  }

  const changeFocusState = async (action: 'pause' | 'resume' | 'finish' | 'cancel') => {
    if (!activeSession) return
    if (action === 'cancel' && !window.confirm(tr('confirmCancelSession'))) return
    const elapsed = elapsedSeconds(activeSession, Date.now())
    const updated: FocusSession = action === 'pause'
      ? { ...activeSession, status: 'paused', elapsedSeconds: elapsed, startedAt: null }
      : action === 'resume'
        ? { ...activeSession, status: 'running', startedAt: Date.now() }
        : action === 'finish'
          ? { ...activeSession, status: 'completed', elapsedSeconds: elapsed, startedAt: null, completedAt: Date.now() }
          : { ...activeSession, status: 'cancelled', elapsedSeconds: elapsed, startedAt: null, completedAt: Date.now() }
    try {
      await updateSession(updated)
      showToast(action === 'cancel' ? tr('sessionCancelled') : action === 'finish' ? tr('sessionFinished') : tr(action === 'pause' ? 'sessionPaused' : 'sessionResumed'))
    } catch { showToast(tr('sessionSaveFailed')) }
  }

  const exportBackup = async () => {
    try {
      const currentTasks = await db.tasks.toArray()
      const currentSessions = await db.sessions.toArray()
      const currentAchievements = await db.achievements.toArray()
      const currentSettings = (await db.settings.get('preferences')) ?? defaultSettings
      const blob = new Blob([JSON.stringify(exportData(currentTasks, currentSessions, currentSettings, currentAchievements), null, 2)], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `daymark-backup-${todayKey(new Date())}.json`
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      showToast(tr('backupDownloaded'))
    } catch { showToast(tr('backupFailed')) }
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const validated = backupSchema.parse(parsed) as BackupFile
      const cleanRecords = removeSampleRecords(validated.tasks, validated.sessions)
      const cleanBackup = { ...validated, ...cleanRecords }
      const mode = window.confirm(tr('backupPreview', { tasks: cleanBackup.tasks.length, sessions: cleanBackup.sessions.length }))
        ? 'merge' : 'replace'
      if (mode === 'replace' && !window.confirm(tr('backupReplaceConfirm'))) return
      await db.transaction('rw', db.tasks, db.sessions, db.settings, db.achievements, async () => {
        if (mode === 'replace') {
          await db.tasks.clear()
          await db.sessions.clear()
          await db.achievements.clear()
        }
        await db.tasks.bulkPut(cleanBackup.tasks)
        await db.sessions.bulkPut(cleanBackup.sessions)
        await db.achievements.bulkPut(cleanBackup.achievements)
        await db.settings.put(cleanBackup.settings)
      })
      showToast(tr(mode === 'merge' ? 'backupMerged' : 'backupRestored'))
    } catch (error) {
      showToast(error instanceof Error ? tr('importFailedDetail', { message: error.message.slice(0, 110) }) : tr('importFailed'))
    }
  }

  const resetData = async () => {
    if (!window.confirm(tr('confirmReset'))) return
    if (!window.confirm(tr('confirmResetAgain'))) return
    try {
      await db.transaction('rw', db.tasks, db.sessions, db.settings, db.achievements, async () => {
        await db.tasks.clear()
        await db.sessions.clear()
        await db.achievements.clear()
        await db.settings.clear()
        await db.settings.put(defaultSettings)
      })
      showToast(tr('resetDone'))
    } catch { showToast(tr('resetFailed')) }
  }

  const setNotification = async () => {
    if (!('Notification' in window)) {
      showToast(tr('notificationsUnsupported'))
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      showToast(tr('permissionDenied'))
      return
    }
    await saveSettings({ notificationsEnabled: true })
  }

  const toggleSubtask = async (task: Task, subtaskId: string, completed: boolean) => {
    try {
      await saveTask({
        ...task,
        subtasks: (task.subtasks ?? []).map((subtask) => subtask.id === subtaskId ? { ...subtask, completed } : subtask),
      })
    } catch {
      showToast(tr('taskChangeFailed'))
    }
  }

  const addSubtaskDraft = () => {
    const title = newSubtaskTitle.trim()
    if (!title) return
    if (subtaskDrafts.length >= 50) {
      showToast(tr('subtaskLimit'))
      return
    }
    setSubtaskDrafts((current) => [...current, { id: uid(), title, completed: false }])
    setNewSubtaskTitle('')
  }

  const renderSubtaskDisclosure = (task: Task) => {
    const subtasks = task.subtasks ?? []
    if (!subtasks.length) return null
    const completedCount = subtasks.filter((subtask) => subtask.completed).length
    const readOnly = section === 'Trash' || section === 'Archive'
    return <details className="subtask-disclosure">
      <summary><span>{tr('subtaskProgress', { completed: completedCount, total: subtasks.length })}</span><span className="subtask-progress-track"><span style={{ width: `${completedCount / subtasks.length * 100}%` }} /></span></summary>
      <ul>{subtasks.map((subtask) => <li key={subtask.id}><label>
        <input type="checkbox" checked={subtask.completed} disabled={readOnly} aria-label={tr('toggleSubtask', { title: subtask.title })} onChange={(event) => void toggleSubtask(task, subtask.id, event.target.checked)} />
        <span className={subtask.completed ? 'subtask-done' : ''}>{subtask.title}</span>
      </label></li>)}</ul>
    </details>
  }

  const renderTaskRow = (task: Task) => (
    <div className="task-row" key={task.id}>
      <input className="check" aria-label={tr(task.status === 'done' ? 'reopenTask' : 'completeTask', { title: task.title })} type="checkbox" checked={task.status === 'done'} onChange={(event) => void switchStatus(task, event.target.checked ? 'done' : 'todo')} />
      <div className="task-main">
        <div className={`task-title ${task.status === 'done' ? 'done' : ''}`}>{task.title}</div>
        <div className="task-meta">
          <span className={`priority-dot priority-${task.priority}`} aria-label={tr('taskPriority', { priority: tr(task.priority) })} />
          <span>{tr(task.priority)}</span>{task.category && <span>· {task.category}</span>}
          {task.dueAt && <span>· {formatDate(task.dueAt, language)}</span>}
          {task.recurrence !== 'none' && <span>· {tr(task.recurrence)}</span>}
          {task.estimateMinutes && <span>· {tr('minutes', { minutes: task.estimateMinutes })}</span>}
        </div>
        {renderSubtaskDisclosure(task)}
      </div>
      <div className="task-actions">
        {section !== 'Trash' && section !== 'Archive' && <button className="mini-btn" aria-label={tr('editTaskAria', { title: task.title })} onClick={() => openTaskDialog(task)}><Settings2 size={14} /></button>}
        {section === 'Trash' || section === 'Archive'
          ? <><button className="mini-btn" aria-label={tr('restoreTask', { title: task.title })} onClick={() => void taskOperation(task, 'restore')}><RotateCcw size={14} /></button>{section === 'Trash' && <button className="mini-btn danger-action" aria-label={tr('deletePermanently', { title: task.title })} onClick={() => void permanentlyDeleteTask(task)}><Trash2 size={14} /></button>}</>
          : <>
            <button className="mini-btn" aria-label={tr('duplicateTask', { title: task.title })} onClick={() => void taskOperation(task, 'duplicate')}><Plus size={14} /></button>
            <button className="mini-btn" aria-label={tr('archiveTask', { title: task.title })} onClick={() => void taskOperation(task, 'archive')}><Archive size={14} /></button>
            <button className="mini-btn" aria-label={tr('trashTask', { title: task.title })} onClick={() => void taskOperation(task, 'trash')}><Trash2 size={14} /></button>
          </>}
      </div>
    </div>
  )

  const renderTaskList = (items: Task[], emptyTitle: string, emptyContent?: React.ReactNode) => items.length
    ? <div className="task-list">{items.map(renderTaskRow)}</div>
    : <div className="empty-state"><div className="empty-icon"><Check size={19} /></div>{emptyContent ?? emptyTitle}</div>

  const saveForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (!taskDialog) return
    await submitTask({
      ...taskDialog,
      title: String(data.get('title') ?? ''),
      description: String(data.get('description') ?? ''),
      priority: String(data.get('priority') ?? 'medium') as Priority,
      status: String(data.get('status') ?? 'todo') as TaskStatus,
      category: String(data.get('category') ?? ''),
      dueAt: data.get('dueAt') ? String(data.get('dueAt')) : null,
      estimateMinutes: data.get('estimate') ? Number(data.get('estimate')) : null,
      recurrence: String(data.get('recurrence') ?? 'none') as Recurrence,
    })
  }

  const renderToday = () => (
    <>
      <aside className="daily-motivation">
        <Sparkles size={15} aria-hidden="true" />
        <div><span>{tr('dailyMotivationLabel')}</span><p>{motivationalQuotes[language][welcomeQuoteIndex]}</p></div>
      </aside>
      <div className="stats-grid">
        <Stat label={tr('openTasks')} value={activeTasks.length.toLocaleString(locale)} note={tr('acrossProjects')} icon={<ListTodo size={15} />} />
        <Stat label={tr('dueToday')} value={todayTasks.filter((task) => task.dueAt && localDateInput(task.dueAt) === todayKey(new Date())).length.toLocaleString(locale)} note={tr('overdueCount', { count: todayTasks.filter((task) => task.dueAt && localDateInput(task.dueAt) < todayKey(new Date())).length.toLocaleString(locale) })} icon={<CalendarDays size={15} />} />
        <Stat label={tr('completed')} value={completedToday.length.toLocaleString(locale)} note={tr('wrappedToday')} icon={<Check size={15} />} />
        <Stat label={tr('focusTime')} value={formatDuration(focusToday, language)} note={tr('goal', { minutes: settings.dailyFocusMinutes.toLocaleString(locale) })} icon={<Clock3 size={15} />} />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading"><h2>{tr('onYourPlate')}</h2><button className="btn subtle" onClick={() => navigateToSection('All Tasks')}>{tr('viewAll')} <ChevronRight size={14} /></button></div>
          <div className="panel-body">{renderTaskList(filteredTasks, tr('nothingToday'), tasks.length === 0 && <div className="first-run"><h3>{tr('firstRunTitle')}</h3><p>{tr('firstRunDescription')}</p><div className="first-run-actions"><button className="btn primary" onClick={() => openTaskDialog({ ...blankTask(), dueAt: todayKey(new Date()) })}><Plus size={14} /> {tr('createFirstTask')}</button></div></div>)}</div>
        </section>
        <section className="panel">
          <div className="panel-heading"><h2>{tr('comingUp')}</h2><CalendarDays className="section-icon" size={15} /></div>
          <div className="panel-body">{renderTaskList(activeTasks.filter((task) => task.dueAt && localDateInput(task.dueAt) > todayKey(new Date())).sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? '')).slice(0, 4), tr('noUpcoming'))}
            {activeSession && <div className="task-row"><span className="priority-dot" style={{ background: 'var(--accent)' }} /><div className="task-main"><div className="task-title">{tr('focusInProgress')}</div><div className="task-meta">{formatTimer(activeElapsed, language)} {tr('elapsed')}</div></div><button className="mini-btn" onClick={() => setSection('Focus')} aria-label={tr('focusInProgress')}><ChevronRight size={15} /></button></div>}
          </div>
        </section>
      </div>
    </>
  )

  const renderCalendar = () => {
    const start = new Date()
    start.setDate(start.getDate() - start.getDay() + calendarOffset * 7)
    start.setHours(0, 0, 0, 0)
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
    return <section className="panel">
      <div className="panel-heading">
        <h2>{tr('agenda')}</h2>
        <div className="calendar-controls">
          <button className="icon-btn" aria-label={tr('previousWeek')} onClick={() => setCalendarOffset((value) => value - 1)}><ChevronLeft size={16} /></button>
          <span className="calendar-date">{dates[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – {dates[6].toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</span>
          <button className="icon-btn" aria-label={tr('nextWeek')} onClick={() => setCalendarOffset((value) => value + 1)}><ChevronRight size={16} /></button>
          <button className="btn subtle" onClick={() => setCalendarOffset(0)}>{tr('today')}</button>
        </div>
      </div>
      <div className="panel-body calendar-list">
        {dates.map((date) => {
          const dayTasks = liveTasks.filter((task) => task.dueAt && localDateInput(task.dueAt) === todayKey(date))
          return <div className="calendar-day" key={todayKey(date)}>
            <div className="calendar-day-label">{date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <div className="calendar-events">
              {dayTasks.map((task) => <button className="event-chip" key={task.id} onClick={() => openTaskDialog(task)}>{task.title}</button>)}
              <button className="mini-btn" aria-label={tr('addDateTask', { date: date.toLocaleDateString(locale) })} onClick={() => openTaskDialog({ ...blankTask(), dueAt: todayKey(date) })}><Plus size={15} /></button>
              {!dayTasks.length && <span style={{ color: '#777b86', fontSize: 10, alignSelf: 'center' }}>{tr('noItems')}</span>}
            </div>
          </div>
        })}
      </div>
    </section>
  }

  const renderKanban = () => {
    const columns: { status: TaskStatus; label: string }[] = [{ status: 'todo', label: tr('toDo') }, { status: 'in-progress', label: tr('inProgress') }, { status: 'done', label: tr('done') }]
    return <div className="kanban">{columns.map((column) => {
      const cards = filteredTasks.filter((task) => task.status === column.status)
      return <section className="kanban-column" key={column.status}>
        <div className="column-title">{column.label}<span className="column-count">{cards.length}</span></div>
        {cards.map((task) => <article className="kanban-card" key={task.id}>
          <div className="kanban-card-title">{task.title}</div>
          <div className="task-meta">{task.category || tr('uncategorized')}{task.dueAt && ` · ${formatDate(task.dueAt, language)}`}</div>
          {renderSubtaskDisclosure(task)}
          <div className="kanban-card-actions"><span className={`priority-dot priority-${task.priority}`} title={tr('taskPriority', { priority: tr(task.priority) })} />
            <select className="select" aria-label={tr('changeStatus', { title: task.title })} value={task.status} onChange={(event) => void switchStatus(task, event.target.value as TaskStatus)}>
              <option value="todo">{tr('toDo')}</option><option value="in-progress">{tr('inProgress')}</option><option value="done">{tr('done')}</option>
            </select>
            <button className="mini-btn" aria-label={tr('editTaskAria', { title: task.title })} onClick={() => openTaskDialog(task)}><Settings2 size={14} /></button>
          </div>
        </article>)}
        <button className="btn subtle" style={{ width: '100%' }} onClick={() => openTaskDialog({ ...blankTask(), status: column.status })}><Plus size={14} /> {tr('addTask')}</button>
      </section>
    })}</div>
  }

  const renderFocus = () => {
    const sessionTask = activeSession ? tasks.find((task) => task.id === activeSession.taskId) : undefined
    const remaining = activeSession ? Math.max(0, activeSession.plannedSeconds - activeElapsed) : focusMinutes * 60
    const progress = activeSession ? Math.min(100, activeElapsed / activeSession.plannedSeconds * 100) : 0
    const completedSessions = sessions.filter((session) => session.status === 'completed')
    return <div className="focus-layout">
      <section className="panel focus-card">
        <div className="session-label">{tr('focusSession')}</div>
        <div className="timer" aria-live="off">{formatTimer(activeSession ? remaining : focusMinutes * 60, language)}</div>
        <div className="timer-label">{activeSession ? activeSession.status === 'paused' ? tr('paused') : tr('timeRemaining') : tr('ready')}</div>
        <div className="progress-track" style={{ maxWidth: 420, margin: '20px auto' }}><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        {activeSession && <p className="subtitle">{tr('actualTime', { time: formatDuration(activeElapsed, language) })} · {tr('planned', { time: formatDuration(activeSession.plannedSeconds, language) })}</p>}
        <div className="focus-controls">
          {!activeSession
            ? <button className="btn primary" onClick={() => void startFocus()}><Play size={15} /> {tr('startFocus')}</button>
            : <>
              {activeSession.status === 'running'
                ? <button className="btn primary" onClick={() => void changeFocusState('pause')}><Pause size={15} /> {tr('pause')}</button>
                : <button className="btn primary" onClick={() => void changeFocusState('resume')}><Play size={15} /> {tr('resume')}</button>}
              <button className="btn" onClick={() => void changeFocusState('finish')}><Check size={15} /> {tr('finish')}</button>
              <button className="btn danger" onClick={() => void changeFocusState('cancel')}><X size={15} /> {tr('cancel')}</button>
            </>}
        </div>
        {!activeSession && <div className="focus-options">
          <select className="select focus-task-select" aria-label={tr('taskForFocus')} value={focusTaskId} onChange={(event) => setFocusTaskId(event.target.value)}>
            <option value="">{tr('chooseTask')}</option>
            {activeTasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}
          </select>
          <select className="select" aria-label={tr('focusDuration')} value={focusMinutes} onChange={(event) => setFocusMinutes(Number(event.target.value))}>
            {[15, 25, 45, 60, 90].map((minutes) => <option value={minutes} key={minutes}>{tr('minutes', { minutes: minutes.toLocaleString(locale) })}</option>)}
          </select>
        </div>}
        {sessionTask && <p className="subtitle" style={{ marginTop: 16 }}>{tr('workingOn')} <strong>{sessionTask.title}</strong></p>}
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>{tr('recentSessions')}</h2><Clock3 className="section-icon" size={15} /></div>
        <div className="panel-body">
          {completedSessions.length ? completedSessions.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 8).map((session) => {
            const task = tasks.find((item) => item.id === session.taskId)
            return <div className="task-row" key={session.id}><div className="empty-icon" style={{ width: 28, height: 28, margin: 0, flex: '0 0 28px' }}><Check size={14} /></div><div className="task-main"><div className="task-title">{task?.title ?? tr('removedTask')}</div><div className="task-meta">{formatDuration(session.elapsedSeconds, language)} · {session.completedAt ? new Date(session.completedAt).toLocaleDateString(locale) : ''}</div></div></div>
          }) : <div className="empty-state">{tr('completedSessionsEmpty')}</div>}
          <div className="settings-section"><h3 className="settings-title">{tr('timerBehavior')}</h3><p className="settings-description">{tr('timerDescription')}</p></div>
        </div>
      </section>
    </div>
  }

  const renderAnalytics = () => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      return date
    })
    const focusByDay = days.map((date) => sessions.filter((session) => session.status === 'completed' && session.completedAt && todayKey(new Date(session.completedAt)) === todayKey(date)).reduce((sum, session) => sum + session.elapsedSeconds, 0))
    const maxSeconds = Math.max(...focusByDay, 60)
    const weekCompleted = liveTasks.filter((task) => task.completedAt && task.completedAt >= Date.now() - 7 * 86400000).length
    const overdue = activeTasks.filter((task) => task.dueAt && localDateInput(task.dueAt) < todayKey(new Date())).length
    return <>
      <div className="stats-grid"><Stat label={tr('completedWeek')} value={weekCompleted.toLocaleString(locale)} note={tr('basedCompletion')} icon={<Check size={15} />} /><Stat label={tr('focusWeek')} value={formatDuration(focusByDay.reduce((sum, value) => sum + value, 0), language)} note={tr('completedSessionsOnly')} icon={<Clock3 size={15} />} /><Stat label={tr('overdue')} value={overdue.toLocaleString(locale)} note={tr('openPastDue')} icon={<CalendarDays size={15} />} /><Stat label={tr('sessions')} value={sessions.filter((session) => session.status === 'completed').length.toLocaleString(locale)} note={tr('completedSessionsOnly')} icon={<BarChart3 size={15} />} /></div>
      <section className="panel"><div className="panel-heading"><h2>{tr('dailyFocusLast7')}</h2><span className="task-meta">{tr('actualRecorded')}</span></div><div className="panel-body"><div className="bar-chart">{days.map((date, index) => <div className="bar-wrap" key={todayKey(date)}><span className="bar-value">{focusByDay[index] ? formatDuration(focusByDay[index], language) : '—'}</span><div className="bar" style={{ height: `${Math.max(2, focusByDay[index] / maxSeconds * 125)}px` }} /><span className="bar-label">{date.toLocaleDateString(locale, { weekday: 'short' })}</span></div>)}</div></div></section>
      {!sessions.length && !liveTasks.some((task) => task.status === 'done') && <div className="subtitle" style={{ marginTop: 15 }}>{tr('chartsEmpty')}</div>}
    </>
  }

  const renderAchievements = () => {
    const unlockedCount = unlockedAchievementCount
    return <>
      <section className="achievement-overview" aria-label={tr('achievementsTitle')}>
        <div className="achievement-overview-icon"><Trophy size={22} /></div>
        <div className="achievement-overview-copy">
          <strong>{tr('achievementSummary', { unlocked: unlockedCount.toLocaleString(locale), total: achievementDefinitions.length.toLocaleString(locale) })}</strong>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${unlockedCount / achievementDefinitions.length * 100}%` }} /></div>
        </div>
      </section>
      <div className="achievement-grid">
        {achievementDefinitions.map((achievement) => {
          const unlock = achievementRecords.find((item) => item.id === achievement.id)
          const progress = achievementProgress[achievement.id] ?? 0
          const percent = Math.min(100, progress / achievement.target * 100)
          return <article className={`achievement-card ${unlock ? 'is-unlocked' : 'is-locked'}`} key={achievement.id}>
            <div className="achievement-card-icon">{unlock ? <Trophy size={19} /> : <LockKeyhole size={17} />}</div>
            <div className="achievement-card-content">
              <h2>{tr(achievement.titleKey)}</h2>
              <p>{tr(achievement.descriptionKey)}</p>
              {unlock
                ? <span className="achievement-status">{tr('achievementUnlockedAt', { date: new Date(unlock.unlockedAt).toLocaleDateString(locale) })}</span>
                : <>
                  <div className="achievement-progress-track" role="progressbar" aria-label={tr(achievement.titleKey)} aria-valuemin={0} aria-valuemax={achievement.target} aria-valuenow={Math.min(progress, achievement.target)}>
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <span className="achievement-status">{progress.toLocaleString(locale)} / {achievement.target.toLocaleString(locale)} · {tr('achievementLocked')}</span>
                </>}
            </div>
          </article>
        })}
      </div>
    </>
  }

  const renderSettings = () => <section className="panel"><div className="panel-heading"><h2>{tr('preferencesData')}</h2><ShieldCheck size={16} color="#67c9a5" /></div><div className="panel-body">
    <div className="settings-section"><h3 className="settings-title">{tr('appearance')}</h3><p className="settings-description">{tr('themeStored')}</p><div className="setting-row"><span className="task-title">{tr('theme')}</span><select className="select" aria-label={tr('theme')} value={settings.theme} onChange={(event) => void saveSettings({ theme: event.target.value as AppSettings['theme'] })}><option value="dark">{tr('dark')}</option><option value="light">{tr('light')}</option></select></div><div className="setting-row" style={{ marginTop: 10 }}><span className="task-title">{tr('languageDirection')}</span><select className="select" aria-label={tr('languageDirection')} value={settings.language} onChange={(event) => void saveSettings({ language: event.target.value as AppSettings['language'] })}><option value="en">{tr('englishLtr')}</option><option value="ar">{tr('arabicRtl')}</option></select></div></div>
    <div className="settings-section"><h3 className="settings-title">{tr('dailyFocusGoal')}</h3><p className="settings-description">{tr('gentleTarget')}</p><div className="setting-row"><span className="task-title">{tr('minutesPerDay')}</span><input className="input" aria-label={tr('minutesPerDay')} type="number" min="0" max="1440" value={settings.dailyFocusMinutes} onChange={(event) => void saveSettings({ dailyFocusMinutes: Number(event.target.value) })} style={{ width: 100 }} /></div></div>
    <div className="settings-section"><h3 className="settings-title">{tr('installSectionTitle')}</h3><p className="settings-description">{tr('installDescription')}</p><div className="setting-row"><span className="task-title">{isAppInstalled ? tr('installStatusInstalled') : tr('installStatusAvailable')}</span>{!isAppInstalled && <button className="btn primary" onClick={() => void installApp()}><Download size={14} /> {tr('installAction')}</button>}</div></div>
    <div className="settings-section"><h3 className="settings-title">{tr('notifications')}</h3><p className="settings-description">{tr('notificationLimit')}</p><div className="setting-row"><span className="task-title">{settings.notificationsEnabled ? tr('enabledBrowser') : tr('notEnabled')}</span><button className="btn" onClick={() => void setNotification()}>{settings.notificationsEnabled ? tr('checkPermission') : tr('enableNotifications')}</button></div></div>
    <div className="settings-section"><h3 className="settings-title">{tr('backupRestore')}</h3><p className="settings-description">{tr('backupDescription')}</p><div className="toolbar"><button className="btn primary" onClick={() => void exportBackup()}><Download size={14} /> {tr('downloadBackup')}</button><button className="btn" onClick={() => importInput?.click()}>{tr('importBackup')}</button><input ref={setImportInput} type="file" accept="application/json,.json" hidden onChange={(event) => { void importBackup(event.target.files?.[0]); event.currentTarget.value = '' }} /></div></div>
    <div className="settings-section"><h3 className="settings-title">{tr('privacyStorage')}</h3><p className="settings-description">{tr('privacyDescription')}</p></div>
    <div className="settings-section"><h3 className="settings-title">{tr('clearData')}</h3><p className="settings-description">{tr('clearDataDescription')}</p><button className="btn danger" onClick={() => void resetData()}><Trash2 size={14} /> {tr('clearLocal')}</button></div>
    </div></section>

  const isList = ['Inbox', 'All Tasks', 'Archive', 'Trash'].includes(section)
  const sectionLabels: Record<Section, MessageKey> = { Today: 'today', Inbox: 'inbox', 'All Tasks': 'allTasks', Calendar: 'calendar', Kanban: 'kanban', Focus: 'focus', Analytics: 'analytics', Achievements: 'achievements', Settings: 'settings', Archive: 'archive', Trash: 'trash' }
  const headingKeys: Record<Section, MessageKey> = { Today: 'todayTitle', Inbox: 'inboxTitle', 'All Tasks': 'allTasksTitle', Calendar: 'calendarTitle', Kanban: 'kanbanTitle', Focus: 'focusTitle', Analytics: 'analyticsTitle', Achievements: 'achievementsTitle', Settings: 'settingsTitle', Archive: 'archiveTitle', Trash: 'trashTitle' }
  const subKeys: Record<Section, MessageKey> = { Today: 'todaySubtitle', Inbox: 'inboxSubtitle', 'All Tasks': 'allTasksSubtitle', Calendar: 'calendarSubtitle', Kanban: 'kanbanSubtitle', Focus: 'focusSubtitle', Analytics: 'analyticsSubtitle', Achievements: 'achievementsSubtitle', Settings: 'settingsSubtitle', Archive: 'archiveSubtitle', Trash: 'trashSubtitle' }
  if (showWelcome) return <main className="welcome-screen">
    <div className="welcome-topbar">
      <div className="welcome-brand"><span className="brand-mark"><img src="./daymark-icon-192.png" alt="" /></span><span className="brand-name">خُطوة</span></div>
      <div className="welcome-controls">
        <button className="icon-btn" title={settings.theme === 'dark' ? tr('switchToLight') : tr('switchToDark')} aria-label={settings.theme === 'dark' ? tr('switchToLight') : tr('switchToDark')} onClick={toggleTheme}>{settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
        <button className="icon-btn language-switch" title={tr('language')} aria-label={tr('language')} onClick={() => void saveSettings({ language: language === 'en' ? 'ar' : 'en' })}><Languages size={16} /></button>
      </div>
    </div>
    <div className="welcome-content">
      <section className="welcome-copy">
        <div className="welcome-symbol" aria-hidden="true"><span /><span /><span /></div>
        <h1>{tr('welcomeTitle')}</h1>
        <p className="welcome-description">{tr('welcomeDescription')}</p>
        <blockquote className="welcome-quote">
          <Sparkles size={16} aria-hidden="true" />
          <div><span>{tr('welcomeQuoteLabel')}</span><p>{motivationalQuotes[language][welcomeQuoteIndex]}</p></div>
        </blockquote>
        <div className="welcome-actions">
          <button className="btn primary welcome-primary" onClick={finishWelcome}>{tr('welcomeStart')}<ChevronRight size={16} /></button>
          <button className="btn subtle welcome-secondary" onClick={() => { setSection('Achievements'); finishWelcome() }}><Trophy size={15} />{tr('welcomeAchievements')}</button>
          {!isAppInstalled && <button className="btn subtle welcome-install" onClick={() => void installApp()}><Download size={15} />{tr('installAction')}</button>}
        </div>
      </section>
      <aside className="welcome-achievements">
        <div className="welcome-achievements-heading"><Trophy size={17} /><strong>{tr('achievements')}</strong></div>
        <div className="welcome-achievement-stats">
          <div><strong>{unlockedAchievementCount.toLocaleString(locale)}</strong><span>{tr('unlockedLabel')}</span></div>
          <div><strong>{achievementDefinitions.length.toLocaleString(locale)}</strong><span>{tr('totalLabel')}</span></div>
        </div>
        <div className="welcome-badge-preview" aria-hidden="true">
          {achievementDefinitions.slice(0, 4).map((achievement) => <span className={unlockedAchievementIds.has(achievement.id) ? 'earned' : ''} key={achievement.id}>{unlockedAchievementIds.has(achievement.id) ? <Trophy size={17} /> : <LockKeyhole size={15} />}</span>)}
        </div>
        <button className="welcome-achievements-link" onClick={() => { setSection('Achievements'); finishWelcome() }}>{tr('welcomeAchievements')}<ChevronRight size={14} /></button>
      </aside>
    </div>
    <footer className="welcome-footer"><LockKeyhole size={14} />{tr('welcomePrivacy')}</footer>
  </main>
  return <div className="app-shell">
    <aside id="app-navigation" className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`} aria-label={tr('workspace')} aria-hidden={Boolean(taskDialog)}>
      <div className="brand"><div className="brand-lockup"><div className="brand-mark"><img src="./daymark-icon-192.png" alt="" /></div><span className="brand-name">خُطوة</span></div><button className="icon-btn mobile-menu-close" aria-label={tr('closeNavigation')} onClick={() => setMobileMenuOpen(false)}><X size={18} /></button></div>
      {(['WORKSPACE', 'MANAGE'] as const).map((group) => <nav key={group} aria-label={group === 'WORKSPACE' ? tr('workspace') : tr('manage')}>
        <div className="nav-label">{group === 'WORKSPACE' ? tr('workspace') : tr('manage')}</div>
        {sections.filter((item) => item.group === group).map(({ name, icon: Icon }) => <button className={`nav-item ${section === name ? 'active' : ''}`} key={name} onClick={() => navigateToSection(name)} aria-label={tr('goTo', { name: tr(sectionLabels[name]) })} title={tr(sectionLabels[name])} aria-current={section === name ? 'page' : undefined}>
          <Icon size={16} strokeWidth={1.8} /><span>{tr(sectionLabels[name])}</span>{name === 'Inbox' && inboxTasks.length > 0 && <span className="nav-count">{inboxTasks.length.toLocaleString(locale)}</span>}
        </button>)}
      </nav>)}
      <div className="sidebar-bottom"><div className="privacy-note"><LockKeyhole size={15} /><span>{tr('privacyShort')}</span></div></div>
    </aside>
    {mobileMenuOpen && <button className="mobile-menu-backdrop" aria-label={tr('closeNavigation')} onClick={() => setMobileMenuOpen(false)} />}
    <main className="main-area" aria-hidden={Boolean(taskDialog)}>
      <header className="topbar">
        <button ref={mobileMenuButtonRef} className="icon-btn mobile-menu-toggle" aria-label={tr('openNavigation')} aria-expanded={mobileMenuOpen} aria-controls="app-navigation" onClick={() => setMobileMenuOpen((open) => !open)}><Menu size={19} /></button>
        <div className="mobile-brand" lang="ar" dir="rtl">خُطوة</div>
        <div className="breadcrumb"><span>{tr('workspace')}</span><ChevronRight size={12} aria-hidden="true" /><span>{tr(sectionLabels[section])}</span></div>
        <div className="top-actions"><button className="icon-btn quick-add-button" title={tr('quickAdd')} aria-label={tr('quickAdd')} onClick={() => openTaskDialog(blankTask())}><Plus size={16} /></button><button className="icon-btn search-open-button" title={tr('searchTasks')} aria-label={tr('searchTasks')} onClick={() => { focusSearchOnSectionChange.current = true; navigateToSection('All Tasks') }}><Search size={16} /></button><button className="icon-btn theme-toggle" title={settings.theme === 'dark' ? tr('switchToLight') : tr('switchToDark')} aria-label={settings.theme === 'dark' ? tr('switchToLight') : tr('switchToDark')} onClick={toggleTheme}>{settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button><button className="icon-btn language-switch" title={tr('language')} aria-label={tr('language')} onClick={() => void saveSettings({ language: language === 'en' ? 'ar' : 'en' })}><Languages size={16} /></button>{!isAppInstalled && <button className="icon-btn mobile-install-button" title={tr('installAction')} aria-label={tr('installAction')} onClick={() => void installApp()}><Download size={16} /></button>}</div>
      </header>
      <div className="content">
        <div className="page-heading"><div><h1>{tr(headingKeys[section])}</h1><p className="subtitle">{tr(subKeys[section])}</p></div>{!['Settings', 'Archive', 'Trash', 'Achievements'].includes(section) && <button className="btn primary" onClick={() => openTaskDialog({ ...blankTask(), dueAt: section === 'Today' ? todayKey(new Date()) : null })}><Plus size={15} /> {tr('newTask')}</button>}</div>
        {showInstallInvite && installPromptEvent && <aside className="install-invite" aria-live="polite">
          <div className="install-invite-copy"><strong>{tr('installTitle')}</strong><p>{tr('installDescription')}</p></div>
          <div className="install-invite-actions">
            <button className="btn primary" onClick={() => void installApp()}><Download size={14} /> {tr('installAction')}</button>
            <button className="install-dismiss" aria-label={tr('dismissInstall')} onClick={() => dismissInstallInvite()}><X size={16} /></button>
          </div>
        </aside>}
        {section === 'Today' && renderToday()}
        {isList && <>{section !== 'Today' && <div className="toolbar">
          <input ref={searchInputRef} id="task-search" aria-label={tr('searchTasksField')} className="input search-input" placeholder={tr('searchPlaceholder')} value={search} onChange={(event) => setSearch(event.target.value)} />
          {section !== 'Inbox' && <select className="select" aria-label={tr('filterPriority')} value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">{tr('allPriorities')}</option>{(['critical', 'high', 'medium', 'low'] as const).map((item) => <option value={item} key={item}>{tr(item)}</option>)}</select>}
          {section !== 'Inbox' && <select className="select" aria-label={tr('filterStatus')} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">{tr('allStatuses')}</option><option value="todo">{tr('toDo')}</option><option value="in-progress">{tr('inProgress')}</option><option value="done">{tr('done')}</option></select>}
          {section !== 'Inbox' && <select className="select" aria-label={tr('filterCategory')} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">{tr('allCategories')}</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>}
          {(search || priorityFilter !== 'all' || statusFilter !== 'all' || categoryFilter !== 'all') && <button className="btn subtle" onClick={() => { setSearch(''); setPriorityFilter('all'); setStatusFilter('all'); setCategoryFilter('all') }}>{tr('clearFilters')}</button>}
        </div>}
          <section className="panel"><div className="panel-heading"><h2>{section === 'Today' ? tr('todayTasks') : tr(sectionLabels[section])}</h2><span className="task-meta">{filteredTasks.length.toLocaleString(locale)} {filteredTasks.length === 1 ? tr('task') : tr('tasks')}</span></div><div className="panel-body">{renderTaskList(filteredTasks, section === 'Inbox' ? tr('inboxEmpty') : section === 'Trash' ? tr('trashEmpty') : section === 'Archive' ? tr('archiveEmpty') : tr('noMatches'), section === 'Inbox' && <div className="inbox-empty-help"><p>{tr('inboxRule')}</p><button className="btn subtle" onClick={() => openTaskDialog(blankTask())}><Plus size={14} /> {tr('captureTask')}</button></div>)}</div></section>
        </>}
        {section === 'Calendar' && renderCalendar()}
        {section === 'Kanban' && <><div className="toolbar"><input className="input search-input" aria-label={tr('filterBoard')} placeholder={tr('filterBoard')} value={search} onChange={(event) => setSearch(event.target.value)} /><select className="select" aria-label={tr('filterBoardPriority')} value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">{tr('allPriorities')}</option>{(['critical', 'high', 'medium', 'low'] as const).map((item) => <option value={item} key={item}>{tr(item)}</option>)}</select><select className="select" aria-label={tr('filterBoardCategory')} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">{tr('allCategories')}</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div>{renderKanban()}</>}
        {section === 'Focus' && renderFocus()}
        {section === 'Analytics' && renderAnalytics()}
        {section === 'Achievements' && renderAchievements()}
        {section === 'Settings' && renderSettings()}
      </div>
    </main>
    {taskDialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTaskDialog() }}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" tabIndex={-1}>
        <div className="modal-heading"><h2 id="task-dialog-title">{tasks.some((item) => item.id === taskDialog.id) ? tr('editTask') : tr('createTask')}</h2><button className="icon-btn" aria-label={tr('closeDialog')} onClick={closeTaskDialog}><X size={16} /></button></div>
        <form onSubmit={(event) => void saveForm(event)}>
          <div className="form-grid">
            <label className="form-field">{tr('title')}<input className="input" name="title" autoFocus maxLength={200} required placeholder={tr('titlePlaceholder')} defaultValue={taskDialog.title} /></label>
            <label className="form-field">{tr('description')}<textarea className="textarea" name="description" rows={3} placeholder={tr('descriptionPlaceholder')} defaultValue={taskDialog.description} /></label>
            <div className="toolbar" style={{ margin: 0 }}>
              <label className="form-field">{tr('priority')}<select className="select" name="priority" defaultValue={taskDialog.priority}>{(['low', 'medium', 'high', 'critical'] as const).map((value) => <option key={value} value={value}>{tr(value)}</option>)}</select></label>
              <label className="form-field">{tr('status')}<select className="select" name="status" defaultValue={taskDialog.status}><option value="todo">{tr('toDo')}</option><option value="in-progress">{tr('inProgress')}</option><option value="done">{tr('done')}</option></select></label>
            </div>
            <div className="toolbar" style={{ margin: 0 }}>
              <label className="form-field">{tr('category')}<input className="input" name="category" maxLength={60} placeholder={tr('categoryPlaceholder')} defaultValue={taskDialog.category} /></label>
              <label className="form-field">{tr('dueDate')}<input className="input" lang={locale} type="date" name="dueAt" defaultValue={localDateInput(taskDialog.dueAt)} /></label>
            </div>
            <div className="toolbar" style={{ margin: 0 }}>
              <label className="form-field">{tr('estimateMinutes')}<input className="input" type="number" name="estimate" min="1" max="100000" defaultValue={taskDialog.estimateMinutes ?? ''} /></label>
              <label className="form-field">{tr('repeat')}<select className="select" name="recurrence" defaultValue={taskDialog.recurrence}><option value="none">{tr('never')}</option><option value="daily">{tr('daily')}</option><option value="weekly">{tr('weekly')}</option><option value="monthly">{tr('monthly')}</option></select></label>
            </div>
            <section className="subtask-editor" aria-labelledby="subtask-editor-title">
              <div className="subtask-editor-heading"><div><h3 id="subtask-editor-title">{tr('subtasks')}</h3><p>{tr('subtaskEditorHelp')}</p></div><span className="task-meta">{subtaskDrafts.length.toLocaleString(locale)} / 50</span></div>
              {subtaskDrafts.map((subtask) => <div className="subtask-draft" key={subtask.id}>
                <input type="checkbox" checked={subtask.completed} aria-label={tr('toggleSubtask', { title: subtask.title || tr('subtaskPlaceholder') })} onChange={(event) => setSubtaskDrafts((current) => current.map((item) => item.id === subtask.id ? { ...item, completed: event.target.checked } : item))} />
                <input className="input" maxLength={120} aria-label={tr('subtaskTitle')} value={subtask.title} onChange={(event) => setSubtaskDrafts((current) => current.map((item) => item.id === subtask.id ? { ...item, title: event.target.value } : item))} />
                <button type="button" className="mini-btn" aria-label={tr('removeSubtask', { title: subtask.title || tr('subtaskPlaceholder') })} onClick={() => setSubtaskDrafts((current) => current.filter((item) => item.id !== subtask.id))}><X size={15} /></button>
              </div>)}
              <div className="subtask-add-row">
                <input className="input" maxLength={120} aria-label={tr('subtaskTitle')} placeholder={tr('subtaskPlaceholder')} value={newSubtaskTitle} onChange={(event) => setNewSubtaskTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSubtaskDraft() } }} />
                <button type="button" className="btn" onClick={addSubtaskDraft} disabled={!newSubtaskTitle.trim() || subtaskDrafts.length >= 50}><Plus size={14} /> {tr('addSubtask')}</button>
              </div>
            </section>
          </div>
          <div className="form-actions"><button type="button" className="btn" onClick={closeTaskDialog}>{tr('cancel')}</button><button type="submit" className="btn primary"><Check size={14} /> {tr('saveTask')}</button></div>
        </form>
      </div>
    </div>}
    {installHelpPlatform && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setInstallHelpPlatform(null) }}>
      <section className="modal install-help" role="dialog" aria-modal="true" aria-labelledby="install-help-title">
        <div className="modal-heading"><h2 id="install-help-title">{tr('installHelpTitle')}</h2><button ref={installHelpCloseRef} className="icon-btn" aria-label={tr('closeInstallHelp')} onClick={() => setInstallHelpPlatform(null)}><X size={16} /></button></div>
        <p className="settings-description">{tr(installHelpPlatform === 'ios' ? 'installHelpIos' : installHelpPlatform === 'android' ? 'installHelpAndroid' : 'installHelpOther')}</p>
        <div className="form-actions"><button className="btn primary" onClick={() => setInstallHelpPlatform(null)}>{tr('closeInstallHelp')}</button></div>
      </section>
    </div>}
    {toast && <div className="toast" role="status">{toast}</div>}
    {achievementCelebration && <>
      <div className="celebration-confetti" aria-hidden="true">
        {Array.from({ length: 36 }, (_, index) => <span
          key={index}
          className={`confetti-piece confetti-${index % 4}`}
          style={{
            left: `${(index * 37 + 11) % 100}%`,
            animationDelay: `${(index % 9) * 0.075}s`,
            animationDuration: `${2.2 + (index % 5) * 0.18}s`,
            '--confetti-drift': `${((index * 29) % 140) - 70}px`,
            '--confetti-rotation': `${(index * 83) % 540}deg`,
          } as CSSProperties}
        />)}
      </div>
      <aside className="achievement-celebration" role="status" aria-live="polite">
        <span className="celebration-emblem"><Trophy size={20} /></span>
        <span className="celebration-copy">
          <strong>{tr('achievementCelebrationTitle')}</strong>
          <span>{achievementCelebration.count > 1
            ? tr('achievementCelebrationMultiple', { count: achievementCelebration.count.toLocaleString(locale) })
            : tr('achievementCelebrationSingle', { title: achievementCelebration.title })}</span>
        </span>
        <button className="celebration-dismiss" aria-label={tr('dismissCelebration')} onClick={() => setAchievementCelebration(null)}><X size={17} /></button>
      </aside>
    </>}
    {activeSession && section !== 'Focus' && <button className="btn primary active-focus-indicator" onClick={() => setSection('Focus')}><Clock3 size={14} /> {formatTimer(Math.max(0, activeSession.plannedSeconds - activeElapsed), language)} · {tr('focus')}</button>}
  </div>
}

function Stat({ label, value, note, icon }: { label: string; value: string | number; note: string; icon: React.ReactNode }) {
  return <div className="stat-card"><div className="stat-label"><span>{label}</span><span className="section-icon">{icon}</span></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>
}

export default App
