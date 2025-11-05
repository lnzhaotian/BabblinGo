import type { CollectionConfig, PayloadRequest } from 'payload'
import materialIconOptions from '../data/materialIconOptions'

const urlValidator = (value: unknown): true | string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'URL is required'
  }

  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return 'URL must use http or https scheme'
    }
    return true
  } catch (_error) {
    return 'URL must be a valid address'
  }
}

const Tools: CollectionConfig = {
  slug: 'tools',
  admin: {
    group: 'Content & Links',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'category', 'order'],
  },
  access: {
    read: () => true,
    create: ({ req }: { req: PayloadRequest }) => Boolean(req.user),
    update: ({ req }: { req: PayloadRequest }) => Boolean(req.user),
    delete: ({ req }: { req: PayloadRequest }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'description',
      type: 'textarea',
      required: false,
      localized: true,
    },
    {
      name: 'url',
      type: 'text',
      required: true,
      validate: urlValidator,
      admin: {
        description: 'Must be a full URL beginning with http:// or https://',
      },
    },
    {
      name: 'category',
      type: 'text',
      required: false,
      admin: {
        description: 'Optional grouping label shown as a pill in the app (e.g., "Test", "Tool")',
      },
    },
    {
      name: 'icon',
      type: 'select',
      required: false,
      options: materialIconOptions,
      admin: {
        description: 'Optional Material Icon. Search to filter the list or clear to use the default.',
        isClearable: true,
        components: {
          Field: '@/fields/IconPickerField.tsx',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'published',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      index: true,
    },
    {
      name: 'order',
      type: 'number',
      required: false,
      index: true,
    },
  ],
  timestamps: true,
}

export default Tools
