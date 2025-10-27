import type { CollectionConfig, CollectionSlug } from 'payload'

import { createSlugField } from '../fields/slug'

export const Lessons: CollectionConfig = {
  slug: 'lessons',
  admin: {
    group: 'BabblinGo',
    useAsTitle: 'title',
    defaultColumns: ['title', 'level', 'order'],
    description: 'Lessons sit within levels and contain multiple modules.',
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
        description: 'Link modules to this lesson in playback order.',
      },
    },
  ],
}
