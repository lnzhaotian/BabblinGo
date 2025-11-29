import type { CollectionConfig, Validate } from 'payload'

import { materialIconGlyphMap } from '../data/materialIconOptions'

const iconValidator: Validate = (value, { siblingData }) => {
  const isMaterial = siblingData?.iconType === 'material' || !siblingData?.iconType

  if (value == null) {
    if (isMaterial) return 'Material Icon is required'
    return true
  }

  if (typeof value !== 'string') {
    return 'Icon must be a text value'
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    if (isMaterial) return 'Material Icon is required'
    return true
  }

  if (!Object.prototype.hasOwnProperty.call(materialIconGlyphMap, trimmed)) {
    return `Icon "${trimmed}" is not available in the mobile app icon set`
  }

  return true
}

const Agents: CollectionConfig = {
  slug: 'agents',
  admin: {
    group: 'Content & Links',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'order'],
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
    {
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'iconType',
      type: 'radio',
      options: [
        { label: 'Material Icon', value: 'material' },
        { label: 'Image', value: 'image' },
      ],
      defaultValue: 'material',
      admin: {
        layout: 'horizontal',
      },
    },
    {
      name: 'icon',
      type: 'text',
      validate: iconValidator,
      admin: {
        description: 'Material Icon name (e.g., "psychology", "chat", "school")',
        condition: (data) => data.iconType === 'material',
      },
    },
    {
      name: 'iconImage',
      type: 'upload',
      relationTo: 'media',
      validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) => {
        if (siblingData?.iconType === 'image' && !value) {
          return 'Image is required'
        }
        return true
      },
      admin: {
        condition: (data) => data.iconType === 'image',
      },
    },
    {
      name: 'difyApiKey',
      type: 'text',
      required: true,
      admin: {
        description: 'The API Key from Dify for this agent',
      },
      access: {
        // Only allow admins to read the API key via API
        read: ({ req: { user } }) => {
          if (user) return true
          return false
        },
      },
    },
    {
      name: 'difyApiUrl',
      type: 'text',
      defaultValue: 'https://ai.babblinguide.cn/v1',
      admin: {
        description: 'The base URL for the Dify API (e.g., https://ai.babblinguide.cn/v1)',
      },
    },
    {
      name: 'welcomeMessage',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'Initial message sent by the agent when chat starts',
      },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Order in the list (lower numbers first)',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        {
          label: 'Draft',
          value: 'draft',
        },
        {
          label: 'Published',
          value: 'published',
        },
      ],
      defaultValue: 'draft',
      required: true,
    },
  ],
}

export default Agents
