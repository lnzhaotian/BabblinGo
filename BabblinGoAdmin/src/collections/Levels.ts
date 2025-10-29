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
  access: {
    read: () => true,
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
      localized: true,
    },
    {
      name: 'lessons',
      type: 'relationship',
      relationTo: 'lessons' as unknown as CollectionSlug,
      hasMany: true,
      admin: {
        description: 'This list auto-populates when lessons are assigned to this level.',
        readOnly: true,
      },
    },
  ],
}
