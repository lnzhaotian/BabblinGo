import type { CollectionConfig, CollectionSlug } from 'payload'

import { createSlugField } from '../fields/slug'
import {
  extractRelationshipId,
  RelationshipValue,
} from './utils/relationshipHelpers'

export const Lessons: CollectionConfig = {
  slug: 'lessons',
  admin: {
    group: 'Course Management',
    useAsTitle: 'title',
    defaultColumns: ['title', 'course', 'level', 'order'],
    description: 'Lessons belong to a course and contain multiple modules. Optional level key groups lessons within a course.',
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        const courseId = extractRelationshipId(doc.course as RelationshipValue)

        if (courseId) {
          try {
            const course = await req.payload.findByID({
              collection: 'courses',
              id: courseId,
              depth: 0,
            })

            await req.payload.update({
              collection: 'courses',
              id: courseId,
              data: {
                status: course.status,
              },
              depth: 0,
            })
          } catch (error) {
            console.error(`Failed to touch course ${courseId} on lesson change`, error)
          }
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
      localized: true,
    },
    createSlugField('title'),
    {
      name: 'order',
      type: 'number',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Optional numeric position used to sort lessons within the course.',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses' as unknown as CollectionSlug,
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Course this lesson belongs to.',
      },
    },
    {
      name: 'level',
      type: 'text',
      required: false,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Optional level key (string) for grouping lessons within a course.'
      }
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
