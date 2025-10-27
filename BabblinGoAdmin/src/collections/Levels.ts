import type { CollectionConfig, CollectionSlug } from 'payload'

import { createSlugField } from '../fields/slug'

export const Levels: CollectionConfig = {
  slug: 'levels',
  admin: {
    group: 'BabblinGo',
    useAsTitle: 'title',
    defaultColumns: ['title', 'order'],
    description: 'Levels group lessons within the BabblinGo curriculum.',
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
        description: 'Optional numeric position used to sort levels.',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
    },
    {
      name: 'lessons',
      type: 'relationship',
      relationTo: 'lessons' as unknown as CollectionSlug,
      hasMany: true,
      admin: {
        description: 'Link lessons that belong to this level in the desired order.',
      },
    },
  ],
}
