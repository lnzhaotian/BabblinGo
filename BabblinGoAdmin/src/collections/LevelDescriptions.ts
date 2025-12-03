import type { CollectionConfig } from 'payload'

export const LevelDescriptions: CollectionConfig = {
  slug: 'level-descriptions',
  admin: {
    group: 'Assessment',
    useAsTitle: 'title',
    defaultColumns: ['standard', 'title', 'level_cefr', 'level_actfl'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'standard',
      type: 'select',
      required: true,
      options: [
        { label: 'CEFR', value: 'cefr' },
        { label: 'ACTFL', value: 'actfl' },
      ],
    },
    {
      name: 'level_cefr',
      type: 'select',
      label: 'Level (CEFR)',
      options: [
        { label: 'A1', value: 'A1' },
        { label: 'A2', value: 'A2' },
        { label: 'B1', value: 'B1' },
        { label: 'B2', value: 'B2' },
        { label: 'C1', value: 'C1' },
        { label: 'C2', value: 'C2' },
      ],
      admin: {
        condition: (_, siblingData) => siblingData.standard === 'cefr',
      },
    },
    {
      name: 'level_actfl',
      type: 'select',
      label: 'Level (ACTFL)',
      options: [
        { label: 'Novice Low', value: 'novice_low' },
        { label: 'Novice Mid', value: 'novice_mid' },
        { label: 'Novice High', value: 'novice_high' },
        { label: 'Intermediate Low', value: 'intermediate_low' },
        { label: 'Intermediate Mid', value: 'intermediate_mid' },
        { label: 'Intermediate High', value: 'intermediate_high' },
        { label: 'Advanced Low', value: 'advanced_low' },
        { label: 'Advanced Mid', value: 'advanced_mid' },
        { label: 'Advanced High', value: 'advanced_high' },
        { label: 'Superior', value: 'superior' },
        { label: 'Distinguished', value: 'distinguished' },
      ],
      admin: {
        condition: (_, siblingData) => siblingData.standard === 'actfl',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Display title, e.g. "Intermediate High"',
      },
    },
    {
      name: 'description',
      type: 'richText',
      required: true,
    },
  ],
}
