import type { CollectionConfig, CollectionSlug } from 'payload'

import { createSlugField } from '../fields/slug'

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
