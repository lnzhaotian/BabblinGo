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
    console.log('[syncModulesOnLessons] Skipping: missing lessonId or moduleId', { lessonId, moduleId })
    return
  }

  console.log(`[syncModulesOnLessons] Starting ${action} for module ${moduleId} on lesson ${lessonId}`)

  try {
    const lesson = await req.payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      locale: req.locale || 'en',
      fallbackLocale: false,
    })

    console.log('[syncModulesOnLessons] Found lesson:', { id: lesson.id, title: lesson.title, currentModules: lesson.modules, locale: req.locale })

    const moduleIds = uniqueRelationshipIds(lesson?.modules as RelationshipValue[])

    const hasModule = moduleIds.includes(moduleId)
    console.log('[syncModulesOnLessons] Module status:', { hasModule, moduleIds })

    if (action === 'add') {
      if (hasModule) {
        console.log('[syncModulesOnLessons] Module already linked, skipping')
        return
      }

      moduleIds.push(moduleId)
      console.log('[syncModulesOnLessons] Adding module, new array:', moduleIds)

      await req.payload.update({
        collection: 'lessons',
        id: lessonId,
        data: {
          title: lesson.title,
          course: lesson.course,
          modules: moduleIds,
        },
        depth: 0,
        locale: req.locale === 'all' ? 'en' : req.locale,
        overrideAccess: true,
        context: mergeContext(req.context, { skipSyncLessonModules: true }),
      })
      console.log('[syncModulesOnLessons] Successfully added module to lesson')
    } else {
      if (!hasModule) {
        console.log('[syncModulesOnLessons] Module not in lesson, skipping removal')
        return
      }

      const nextModuleIds = moduleIds.filter((id) => id !== moduleId)
      console.log('[syncModulesOnLessons] Removing module, new array:', nextModuleIds)

      await req.payload.update({
        collection: 'lessons',
        id: lessonId,
        data: {
          title: lesson.title,
          course: lesson.course,
          modules: nextModuleIds,
        },
        depth: 0,
        locale: req.locale === 'all' ? 'en' : req.locale,
        overrideAccess: true,
        context: mergeContext(req.context, { skipSyncLessonModules: true }),
      })
      console.log('[syncModulesOnLessons] Successfully removed module from lesson')
    }
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
    group: 'Course Management',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'lesson', 'order'],
    description:
      'Modules are the lowest level of lesson content. Select a module type, then provide the matching media and copy.',
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        console.log('[Modules afterChange] Hook triggered', { 
          docId: doc?.id, 
          skipSync: req?.context?.skipSyncLessonModules 
        })

        if (!doc?.id || req?.context?.skipSyncLessonModules) {
          console.log('[Modules afterChange] Skipping sync (no docId or skipSync flag)')
          return doc
        }

        const currentLessonId = extractRelationshipId(doc.lesson as RelationshipValue)
        const previousLessonId = extractRelationshipId(previousDoc?.lesson as RelationshipValue)

        console.log('[Modules afterChange] Lesson IDs:', { currentLessonId, previousLessonId })

        if (previousLessonId && previousLessonId !== currentLessonId) {
          console.log('[Modules afterChange] Lesson changed, removing from old lesson')
          await syncModulesOnLessons(req, previousLessonId, doc.id, 'remove')
        }

        if (currentLessonId) {
          console.log('[Modules afterChange] Adding to current lesson')
          await syncModulesOnLessons(req, currentLessonId, doc.id, 'add')
        }

        console.log('[Modules afterChange] Sync complete')
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
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'audioSlideshow',
      options: [
        {
          label: 'Audio Slideshow',
          value: 'audioSlideshow',
        },
        {
          label: 'Video',
          value: 'video',
        },
        {
          label: 'Rich Post',
          value: 'richPost',
        },
        {
          label: 'Audio (Playlist)',
          value: 'audio',
        },
      ],
      admin: {
        description: 'Determines how the lesson module is rendered for learners.',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: {
        description: 'Optional short summary that appears in lesson overviews.',
      },
    },
    {
      name: 'audioSlideshow',
      label: 'Audio Slideshow Content',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'audioSlideshow',
        description: 'Slides with imagery and per-slide audio clips. Works with the existing slideshow + audio player.',
      },
      fields: [
        {
          name: 'slides',
          type: 'array',
          required: true,
          minRows: 1,
          admin: {
            description: 'Ordered slides presented alongside narration. At least one slide is required.',
          },
          fields: [
            {
              name: 'title',
              type: 'text',
              admin: {
                description: 'Optional slide title displayed in the player and analytics.',
              },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Primary visual for the slide. Required when no video is present.',
              },
            },
            {
              name: 'audio',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Optional slide-specific audio narration.',
              },
            },
            {
              name: 'body',
              label: 'Slide Body',
              type: 'richText',
              admin: {
                description: 'Optional rich text copy that appears beneath the image.',
              },
            },
          ],
        },
        {
          name: 'transcript',
          label: 'Module Transcript',
          type: 'richText',
          admin: {
            description: 'Optional transcript or extended notes for the module.',
          },
        },
      ],
    },
    {
      name: 'video',
      label: 'Video Content',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'video',
        description: 'Upload a video or provide an external streaming URL with supporting copy.',
      },
      fields: [
        {
          name: 'videoFile',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Upload a hosted video file (MP4, MOV, etc.).',
          },
        },
        {
          name: 'streamUrl',
          type: 'text',
          admin: {
            description: 'External streaming URL (e.g., Mux, Vimeo, S3). Use when not uploading a file.',
            placeholder: 'https://example.com/video.m3u8',
          },
        },
        {
          name: 'posterImage',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Optional poster image displayed before playback.',
          },
        },
        {
          name: 'captions',
          type: 'array',
          admin: {
            description: 'Optional caption/subtitle files (WebVTT).',
          },
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
            },
            {
              name: 'file',
              type: 'upload',
              relationTo: 'media',
              required: true,
            },
            {
              name: 'language',
              type: 'text',
              admin: {
                description: 'BCP-47 language tag (e.g., en, en-US, zh-CN).',
              },
            },
          ],
        },
        {
          name: 'transcript',
          type: 'richText',
          admin: {
            description: 'Optional transcript or supporting copy for the video.',
          },
        },
      ],
    },
    {
      name: 'richPost',
      label: 'Rich Post Content',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'richPost',
        description: 'Long-form lesson content combining text and media blocks.',
      },
      fields: [
        {
          name: 'body',
          label: 'Post Body',
          type: 'richText',
          required: true,
        },
        {
          name: 'mediaGallery',
          type: 'array',
          admin: {
            description: 'Optional supporting images or documents embedded in the post.',
          },
          fields: [
            {
              name: 'media',
              type: 'upload',
              relationTo: 'media',
              required: true,
            },
            {
              name: 'caption',
              type: 'text',
            },
          ],
        },
      ],
    },
    {
      name: 'audio',
      label: 'Audio Playlist Content',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'audio',
        description: 'One or more audio tracks presented without slides.',
      },
      fields: [
        {
          name: 'tracks',
          type: 'array',
          required: true,
          minRows: 1,
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
            },
            {
              name: 'audio',
              type: 'upload',
              relationTo: 'media',
              required: true,
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Optional cover art for this track.',
              },
            },
            {
              name: 'durationSeconds',
              type: 'number',
              admin: {
                description: 'Optional duration in seconds (used for progress estimates).',
              },
            },
            {
              name: 'transcript',
              type: 'richText',
              admin: {
                description: 'Optional per-track transcript or notes.',
              },
            },
          ],
        },
        {
          name: 'introduction',
          type: 'richText',
          admin: {
            description: 'Optional introduction shown before the playlist.',
          },
        },
      ],
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
