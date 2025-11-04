import type { CourseDoc, LessonDoc } from '@/lib/payload'

export type AnalyticsEvent = {
  name: string
  timestamp: string
  payload: Record<string, unknown>
}

type AnalyticsListener = (event: AnalyticsEvent) => void

const listeners = new Set<AnalyticsListener>()
const buffer: AnalyticsEvent[] = []
const MAX_BUFFER_SIZE = 50

const pushToBuffer = (event: AnalyticsEvent) => {
  buffer.push(event)
  if (buffer.length > MAX_BUFFER_SIZE) {
    buffer.shift()
  }
}

export const subscribeToAnalytics = (listener: AnalyticsListener): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getAnalyticsBuffer = (): AnalyticsEvent[] => [...buffer]

export const __resetAnalyticsForTests = (): void => {
  buffer.length = 0
  listeners.clear()
}

const normalizeLocalizedField = (
  value: string | Record<string, string | null> | null | undefined,
  locale: string
): string | undefined => {
  if (!value) {
    return undefined
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  const direct = value[locale]
  if (typeof direct === 'string') {
    const trimmed = direct.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }

  for (const entry of Object.values(value)) {
    if (typeof entry === 'string') {
      const trimmed = entry.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
  }

  return undefined
}

const extractCourseId = (course: LessonDoc['course']): string | undefined => {
  if (!course) {
    return undefined
  }

  if (typeof course === 'string') {
    return course
  }

  return course.id
}

export type LearningSyncTrigger = 'scheduled' | 'manual' | 'login' | 'appStart' | 'background'

export type LearningSyncFetchStatus = 'ok' | 'unauthorized' | 'error'

export type LearningSyncStartedMetrics = {
  localCount: number
  dirtyCount: number
  trigger?: LearningSyncTrigger | 'unknown'
}

export type LearningSyncCompletedMetrics = {
  durationMs: number
  localCount: number
  dirtyBefore: number
  dirtyAfter: number
  remoteFetched: number
  pushAttempted: number
  pushFailed: number
  fetchStatus: LearningSyncFetchStatus
  fetchError?: string
  trigger?: LearningSyncTrigger | 'unknown'
}

export type LearningSyncFailedMetrics = {
  durationMs: number
  localCount: number
  dirtyBefore: number
  errorMessage: string
  stage?: 'fetch' | 'push' | 'persist' | 'unknown'
  statusCode?: number
  trigger?: LearningSyncTrigger | 'unknown'
}

export type LearningSyncSkippedMetrics = {
  reason: 'unauthenticated' | 'offline' | 'cooldown' | 'unknown'
  localCount: number
  dirtyCount: number
  trigger?: LearningSyncTrigger | 'unknown'
}

const emitEvent = (name: string, payload: Record<string, unknown>): void => {
  const event: AnalyticsEvent = {
    name,
    timestamp: new Date().toISOString(),
    payload,
  }

  pushToBuffer(event)

  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch (error) {
      console.error('[analytics] listener error', error)
    }
  })

  if (process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === 'true') {
    // Helpful during development; can be disabled in production builds.
    console.debug(`[analytics] ${name}`, payload)
  }
}

export const trackEvent = (name: string, payload: Record<string, unknown> = {}): void => {
  emitEvent(name, payload)
}

export const recordCourseView = (
  course: CourseDoc,
  context: { locale: string; lessonCount: number }
): void => {
  const { locale, lessonCount } = context
  const localizedTitle = normalizeLocalizedField(course.title, locale)

  trackEvent('course_viewed', {
    courseId: course.id,
    courseSlug: course.slug,
    courseTitle: localizedTitle,
    locale,
    levelCount: course.levels?.length ?? 0,
    lessonCount,
    status: course.status ?? null,
  })
}

export const recordLessonOpened = (
  lesson: LessonDoc,
  context: { locale: string; courseId?: string | null }
): void => {
  const { locale, courseId } = context
  const resolvedCourseId = courseId ?? extractCourseId(lesson.course) ?? null

  trackEvent('lesson_opened', {
    lessonId: lesson.id,
    lessonSlug: lesson.slug,
    locale,
    courseId: resolvedCourseId,
    level: lesson.level ?? null,
    hasModules: Array.isArray(lesson.modules) && lesson.modules.length > 0,
  })
}

export const recordLearningSyncStarted = (metrics: LearningSyncStartedMetrics): void => {
  const { localCount, dirtyCount, trigger = 'scheduled' } = metrics

  trackEvent('learning_sync_started', {
    localCount,
    dirtyCount,
    trigger,
  })
}

export const recordLearningSyncCompleted = (metrics: LearningSyncCompletedMetrics): void => {
  const {
    durationMs,
    localCount,
    dirtyBefore,
    dirtyAfter,
    remoteFetched,
    pushAttempted,
    pushFailed,
    fetchStatus,
    fetchError,
    trigger = 'scheduled',
  } = metrics

  const completionStatus = pushFailed === 0
    ? 'success'
    : pushAttempted > 0 && pushFailed >= pushAttempted
      ? 'failed'
      : 'partial'

  trackEvent('learning_sync_completed', {
    durationMs,
    localCount,
    dirtyBefore,
    dirtyAfter,
    queueDelta: dirtyAfter - dirtyBefore,
    remoteFetched,
    pushAttempted,
    pushFailed,
    fetchStatus,
    fetchError: fetchError ?? null,
    trigger,
    status: completionStatus,
  })
}

export const recordLearningSyncFailed = (metrics: LearningSyncFailedMetrics): void => {
  const {
    durationMs,
    localCount,
    dirtyBefore,
    errorMessage,
    stage = 'unknown',
    statusCode,
    trigger = 'scheduled',
  } = metrics

  trackEvent('learning_sync_failed', {
    durationMs,
    localCount,
    dirtyBefore,
    errorMessage,
    stage,
    statusCode: statusCode ?? null,
    trigger,
  })
}

export const recordLearningSyncSkipped = (metrics: LearningSyncSkippedMetrics): void => {
  const { reason, localCount, dirtyCount, trigger = 'scheduled' } = metrics

  trackEvent('learning_sync_skipped', {
    reason,
    localCount,
    dirtyCount,
    trigger,
  })
}
