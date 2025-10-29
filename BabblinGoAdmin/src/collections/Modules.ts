import type { CollectionConfig, CollectionSlug, PayloadRequest } from 'payload'

import { createSlugField } from '../fields/slug'
import {
  extractRelationshipId,
  mergeContext,
  RelationshipValue,
  uniqueRelationshipIds,
} from './utils/relationshipHelpers'

const syncModulesOnLessons = async (
  req: PayloadRequest,
  lessonId: string,
  moduleId: string,
  action: 'add' | 'remove'
) => {
  if (!lessonId || !moduleId) {
    return
  }

  try {
    const lesson = await req.payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
    })

    const moduleIds = uniqueRelationshipIds(lesson?.modules as RelationshipValue[])

    const hasModule = moduleIds.includes(moduleId)

    if (action === 'add') {
      if (hasModule) {
        return
      }

      moduleIds.push(moduleId)
    } else {
      if (!hasModule) {
        return
      }

      const nextModuleIds = moduleIds.filter((id) => id !== moduleId)

      await req.payload.update({
        collection: 'lessons',
        id: lessonId,
        data: { modules: nextModuleIds },
        depth: 0,
        context: mergeContext(req.context, { skipSyncLessonModules: true }),
      })
      return
    }

    await req.payload.update({
      collection: 'lessons',
      id: lessonId,
      data: { modules: moduleIds },
      depth: 0,
      context: mergeContext(req.context, { skipSyncLessonModules: true }),
    })
  } catch (error) {
    console.error(
      `[payload] Failed to ${action === 'add' ? 'link' : 'unlink'} module ${moduleId} ${
        action === 'add' ? 'to' : 'from'
      } lesson ${lessonId}`,
      error
    )
  }
}

export const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    group: 'BabblinGo',
    useAsTitle: 'title',
    defaultColumns: ['title', 'lesson', 'order'],
    description: 'Modules are the lowest level of content and can include media and transcripts.',
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (!doc?.id || req?.context?.skipSyncLessonModules) {
          return doc
        }

        const currentLessonId = extractRelationshipId(doc.lesson as RelationshipValue)
        const previousLessonId = extractRelationshipId(previousDoc?.lesson as RelationshipValue)

        if (previousLessonId && previousLessonId !== currentLessonId) {
          await syncModulesOnLessons(req, previousLessonId, doc.id, 'remove')
        }

        if (currentLessonId) {
          await syncModulesOnLessons(req, currentLessonId, doc.id, 'add')
        }

        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (!doc?.id || req?.context?.skipSyncLessonModules) {
          return doc
        }

        const lessonId = extractRelationshipId(doc.lesson as RelationshipValue)

        if (lessonId) {
          await syncModulesOnLessons(req, lessonId, doc.id, 'remove')
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
        description: 'Optional numeric position used to order modules within a lesson.',
      },
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons' as unknown as CollectionSlug,
      required: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Primary visual used when presenting this module.',
      },
    },
    {
      name: 'audio',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Narration or audio file associated with this module.',
      },
    },
    {
      name: 'body',
      label: 'Module Content',
      type: 'richText',
      required: true,
    },
    {
      name: 'resources',
      type: 'array',
      admin: {
        description: 'Optional supporting links or downloads for the module.',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'url',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
