import { beforeEach, describe, expect, it } from 'vitest'

import {
  __resetAnalyticsForTests,
  getAnalyticsBuffer,
  recordCourseView,
  recordLessonOpened,
  recordLearningSyncCompleted,
  recordLearningSyncFailed,
  recordLearningSyncSkipped,
  recordLearningSyncStarted,
  trackEvent,
} from '@/lib/analytics'
import type { CourseDoc, LessonDoc } from '@/lib/payload'

describe('analytics', () => {
  beforeEach(() => {
    __resetAnalyticsForTests()
  })

  it('stores tracked events in the buffer', () => {
    trackEvent('test_event', { foo: 'bar' })

    const events = getAnalyticsBuffer()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      name: 'test_event',
      payload: { foo: 'bar' },
    })
    expect(typeof events[0].timestamp).toBe('string')
  })

  it('records course views with normalized metadata', () => {
    const course: CourseDoc = {
      id: 'course-123',
      slug: 'course-123',
      title: { en: 'Course Title', zh: '课程标题' },
      description: null,
      coverImage: null,
      order: 2,
      status: 'published',
      levels: [
        { id: 'lvl-1', key: 'beginner', label: { en: 'Beginner' }, order: 1 },
        { id: 'lvl-2', key: 'advanced', label: { en: 'Advanced' }, order: 2 },
      ],
    }

    recordCourseView(course, { locale: 'en', lessonCount: 5 })

    const [event] = getAnalyticsBuffer()
    expect(event.name).toBe('course_viewed')
    expect(event.payload).toMatchObject({
      courseId: 'course-123',
      courseSlug: 'course-123',
      courseTitle: 'Course Title',
      locale: 'en',
      levelCount: 2,
      lessonCount: 5,
      status: 'published',
    })
  })

  it('records lesson opened events with inferred course id', () => {
    const lesson: LessonDoc = {
      id: 'lesson-456',
      slug: 'lesson-456',
      title: 'Lesson Title',
      summary: null,
      order: 1,
      level: 'beginner',
      course: 'course-123',
      modules: [
        {
          id: 'module-1',
          title: 'Module',
          lesson: 'lesson-456',
          summary: null,
          order: 1,
          audio: null,
          audioSlideshow: null,
          richPost: null,
          video: null,
          resources: null,
        },
      ],
      updatedAt: new Date().toISOString(),
    }

    recordLessonOpened(lesson, { locale: 'en', courseId: null })

    const [event] = getAnalyticsBuffer()
    expect(event.name).toBe('lesson_opened')
    expect(event.payload).toMatchObject({
      lessonId: 'lesson-456',
      lessonSlug: 'lesson-456',
      locale: 'en',
      courseId: 'course-123',
      level: 'beginner',
      hasModules: true,
    })
  })

  it('records learning sync lifecycle events', () => {
    recordLearningSyncStarted({ localCount: 3, dirtyCount: 2, trigger: 'manual' })
    recordLearningSyncCompleted({
      durationMs: 1200,
      localCount: 4,
      dirtyBefore: 2,
      dirtyAfter: 0,
      remoteFetched: 5,
      pushAttempted: 2,
      pushFailed: 0,
      fetchStatus: 'ok',
      trigger: 'manual',
    })
    recordLearningSyncFailed({
      durationMs: 500,
      localCount: 1,
      dirtyBefore: 1,
      errorMessage: 'Unauthorized',
      stage: 'fetch',
      statusCode: 401,
      trigger: 'login',
    })
    recordLearningSyncSkipped({
      reason: 'unauthenticated',
      localCount: 0,
      dirtyCount: 0,
      trigger: 'scheduled',
    })

    const events = getAnalyticsBuffer()
    expect(events.map((entry) => entry.name)).toEqual([
      'learning_sync_started',
      'learning_sync_completed',
      'learning_sync_failed',
      'learning_sync_skipped',
    ])

    expect(events[1].payload).toMatchObject({
      queueDelta: -2,
      status: 'success',
      fetchStatus: 'ok',
      pushAttempted: 2,
      pushFailed: 0,
    })

    expect(events[2].payload).toMatchObject({
      errorMessage: 'Unauthorized',
      statusCode: 401,
      trigger: 'login',
    })
  })
})
