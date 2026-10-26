import { describe, expect, it } from 'vitest'
import { achievements } from './achievements'
import { defaultSettings } from './db'
import { translate } from './i18n'
import { motivationalQuotes } from './motivations'

describe('English and Arabic UI translations', () => {
  it('uses Arabic as the first-run language', () => {
    expect(defaultSettings.language).toBe('ar')
  })

  it('translates navigation, forms, and timer controls', () => {
    expect(translate('ar', 'today')).toBe('اليوم')
    expect(translate('ar', 'saveTask')).toBe('حفظ المهمة')
    expect(translate('ar', 'pause')).toBe('إيقاف مؤقت')
    expect(translate('ar', 'switchToLight')).toBe('التبديل إلى الوضع الفاتح')
    expect(translate('en', 'switchToDark')).toBe('Switch to dark mode')
    expect(translate('en', 'pause')).toBe('Pause')
    expect(translate('ar', 'openNavigation')).toBe('فتح قائمة الصفحات')
    expect(translate('en', 'closeNavigation')).toBe('Close navigation')
  })

  it('interpolates labels in both languages', () => {
    expect(translate('ar', 'goTo', { name: 'اليوم' })).toBe('الانتقال إلى اليوم')
    expect(translate('en', 'goal', { minutes: 120 })).toBe('Goal: 120m')
  })

  it('provides localized installation actions with the Arabic app name', () => {
    expect(translate('en', 'installAction')).toBe('Install خُطوة')
    expect(translate('ar', 'installAction')).toBe('تثبيت خُطوة')
    expect(translate('ar', 'installTitle')).toContain('خُطوة')
    expect(translate('ar', 'installHelpIos')).toContain('Safari')
    expect(translate('en', 'installHelpAndroid')).toContain('Chrome')
    expect(translate('ar', 'installStatusInstalled')).toBe('مثبّت على هذا الجهاز')
  })

  it('translates subtask controls and progress in both languages', () => {
    expect(translate('en', 'subtaskProgress', { completed: 2, total: 4 })).toBe('2 of 4 steps complete')
    expect(translate('ar', 'subtasks')).toBe('الخطوات الفرعية')
    expect(translate('ar', 'completeWithSubtasks', { count: 3 })).toContain('3')
  })

  it('provides a substantial set of unique rotating welcome messages in both languages', () => {
    for (const quotes of Object.values(motivationalQuotes)) {
      expect(quotes.length).toBeGreaterThanOrEqual(75)
      expect(new Set(quotes).size).toBe(quotes.length)
    }
    expect(motivationalQuotes.ar.every((quote) => !/[\u064B-\u0650\u0652-\u065F\u0670]/u.test(quote))).toBe(true)
    expect(translate('ar', 'welcomeStart')).toBe('ابدأ خطوتك')
    expect(translate('en', 'welcomeAchievements')).toBe('See achievements')
  })

  it('provides achievement celebration and milestone copy in both languages', () => {
    expect(translate('ar', 'achievementCelebrationSingle', { title: 'البداية' })).toContain('البداية')
    expect(translate('en', 'achievementCelebrationMultiple', { count: 2 })).toContain('2')
    for (const achievement of achievements) {
      expect(translate('ar', achievement.titleKey)).not.toBe(translate('en', achievement.titleKey))
      expect(translate('ar', achievement.descriptionKey)).not.toBe(translate('en', achievement.descriptionKey))
    }
  })
})
