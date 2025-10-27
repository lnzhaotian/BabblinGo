import type { FieldHook, Field } from 'payload'

const formatSlug = (value: string): string =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

const buildSlugHook = (sourceField: string): FieldHook =>
  ({ data, originalDoc, value }) => {
    const existingValue = typeof value === 'string' ? value : ''
    const candidate = existingValue || (data?.[sourceField] as string) || (originalDoc?.[sourceField] as string)

    if (!candidate) {
      return existingValue
    }

    return formatSlug(candidate)
  }

export const createSlugField = (sourceField = 'title'): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  admin: {
    position: 'sidebar',
  },
  hooks: {
    beforeValidate: [buildSlugHook(sourceField)],
  },
})
