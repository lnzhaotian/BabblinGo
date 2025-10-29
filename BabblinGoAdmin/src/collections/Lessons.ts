import type { CollectionConfig, CollectionSlug, PayloadRequest } from 'payload'

import { createSlugField } from '../fields/slug'
import {
  extractRelationshipId,
  mergeContext,
  uniqueRelationshipIds,
  RelationshipValue,
} from './utils/relationshipHelpers'

const addLessonToLevel = async (req: PayloadRequest, levelId: string, lessonId: string) => {
  if (!levelId || !lessonId) {
    return
  }

  try {
    const level = await req.payload.findByID({
      collection: 'levels',
      id: levelId,
      depth: 0,
    })

    const lessonIds = uniqueRelationshipIds(level?.lessons as RelationshipValue[])

    if (lessonIds.includes(lessonId)) {
      return
    }

    lessonIds.push(lessonId)

    await req.payload.update({
      collection: 'levels',
      id: levelId,
      data: { lessons: lessonIds },
      depth: 0,
      context: mergeContext(req.context, { skipSyncLevelLessons: true }),
    })
  } catch (error) {
    console.error(`[payload] Failed to link lesson ${lessonId} to level ${levelId}`, error)
  }
}

const removeLessonFromLevel = async (req: PayloadRequest, levelId: string, lessonId: string) => {
  if (!levelId || !lessonId) {
    return
  }

  try {
    const level = await req.payload.findByID({
      collection: 'levels',
      id: levelId,
      depth: 0,
    })

    const lessonIds = uniqueRelationshipIds(level?.lessons as RelationshipValue[])

    if (!lessonIds.includes(lessonId)) {
      return
    }

    const nextLessonIds = lessonIds.filter((id) => id !== lessonId)

    await req.payload.update({
      collection: 'levels',
      id: levelId,
      data: { lessons: nextLessonIds },
      depth: 0,
      context: mergeContext(req.context, { skipSyncLevelLessons: true }),
    })
  } catch (error) {
    console.error(`[payload] Failed to unlink lesson ${lessonId} from level ${levelId}`, error)
  }
}

export const Lessons: CollectionConfig = {
  slug: 'lessons',
  admin: {
    group: 'BabblinGo',
    useAsTitle: 'title',
    defaultColumns: ['title', 'level', 'order'],
    description: 'Lessons sit within levels and contain multiple modules.',
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (!doc?.id || req?.context?.skipSyncLevelLessons) {
          return doc
        }

        const currentLevelId = extractRelationshipId(doc.level as RelationshipValue)
        const previousLevelId = extractRelationshipId(previousDoc?.level as RelationshipValue)

        if (previousLevelId && previousLevelId !== currentLevelId) {
          await removeLessonFromLevel(req, previousLevelId, doc.id)
        }

        if (currentLevelId) {
          await addLessonToLevel(req, currentLevelId, doc.id)
        }

        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (!doc?.id || req?.context?.skipSyncLevelLessons) {
          return doc
        }

        const levelId = extractRelationshipId(doc.level as RelationshipValue)

        if (levelId) {
          await removeLessonFromLevel(req, levelId, doc.id)
        }

        return doc
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    createSlugField('title'),
    {
      name: 'order',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'Optional numeric position used to sort lessons within a level.',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'level',
      type: 'relationship',
      relationTo: 'levels' as unknown as CollectionSlug,
      required: true,
    },
    {
      name: 'modules',
      type: 'relationship',
      relationTo: 'modules' as unknown as CollectionSlug,
      hasMany: true,
      admin: {
        description:
          'Modules linked to this lesson sync automatically based on each module configuration.',
        readOnly: true,
      },
    },
  ],
}
