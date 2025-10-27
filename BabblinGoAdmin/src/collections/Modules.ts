import type { CollectionConfig, CollectionSlug } from 'payload'

import { createSlugField } from '../fields/slug'

export const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    group: 'BabblinGo',
    useAsTitle: 'title',
    defaultColumns: ['title', 'lesson', 'order'],
    description: 'Modules are the lowest level of content and can include media and transcripts.',
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
