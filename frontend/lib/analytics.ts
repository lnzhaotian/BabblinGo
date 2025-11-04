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
