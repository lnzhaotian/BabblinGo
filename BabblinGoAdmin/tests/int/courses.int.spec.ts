import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

let payload: Payload

const createdLessonIds: string[] = []
let createdCourseId: string | null = null

const uniqueSuffix = () => Math.random().toString(36).slice(2, 10)

describe('Courses API shape', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  afterAll(async () => {
    if (createdLessonIds.length > 0) {
      await Promise.all(
        createdLessonIds.map((id) =>
          payload.delete({ collection: 'lessons', id, overrideAccess: true }).catch(() => undefined)
        )
      )
    }

    if (createdCourseId) {
      await payload.delete({ collection: 'courses', id: createdCourseId, overrideAccess: true }).catch(() => undefined)
      createdCourseId = null
    }
  })

  it('creates and fetches courses with their lessons', async () => {
    const courseSlug = `test-course-${uniqueSuffix()}`
    const course = await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: {
        slug: courseSlug,
        title: 'Test Course',
        description: 'Auto-generated test course',
        status: 'published',
        levels: [
          {
            key: 'beginner',
            label: 'Beginner',
            order: 1,
          },
        ],
      },
    })
    createdCourseId = course.id

    const lessonOneSlug = `lesson-one-${uniqueSuffix()}`
    const lessonTwoSlug = `lesson-two-${uniqueSuffix()}`

    const lessonTwo = await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: {
        title: 'Lesson Two',
        slug: lessonTwoSlug,
        course: course.id,
        order: 2,
        level: 'beginner',
        summary: 'Second lesson',
      },
    })

    const lessonOne = await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: {
        title: 'Lesson One',
        slug: lessonOneSlug,
        course: course.id,
        order: 1,
        level: 'beginner',
        summary: 'First lesson',
      },
    })

    createdLessonIds.push(lessonOne.id, lessonTwo.id)

    const coursesResponse = await payload.find({
      collection: 'courses',
      where: {
        slug: { equals: courseSlug },
      },
      depth: 0,
    })

    expect(coursesResponse.docs).toHaveLength(1)
    expect(coursesResponse.docs[0]).toMatchObject({
      slug: courseSlug,
      levels: [
        expect.objectContaining({ key: 'beginner' }),
      ],
    })

    const lessonsResponse = await payload.find({
      collection: 'lessons',
      where: {
        course: { equals: course.id },
      },
      sort: 'order',
      depth: 0,
    })

    expect(lessonsResponse.docs).toHaveLength(2)
    expect(lessonsResponse.docs.map((doc) => doc.slug)).toEqual([lessonOneSlug, lessonTwoSlug])
    expect(lessonsResponse.docs.every((doc) => doc.course === course.id)).toBe(true)

    const beginnerLessons = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          { course: { equals: course.id } },
          { level: { equals: 'beginner' } },
        ],
      },
      depth: 0,
    })

    expect(beginnerLessons.docs).toHaveLength(2)

    const advancedLessons = await payload.find({
      collection: 'lessons',
      where: {
        and: [
          { course: { equals: course.id } },
          { level: { equals: 'advanced' } },
        ],
      },
      depth: 0,
    })

    expect(advancedLessons.docs).toHaveLength(0)
  })
})
