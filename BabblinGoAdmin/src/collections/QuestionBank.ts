import type { CollectionConfig } from 'payload'

export const QuestionBank: CollectionConfig = {
  slug: 'question-bank',
  admin: {
    group: 'Assessment',
    useAsTitle: 'id',
    defaultColumns: ['type', 'difficulty_cefr', 'difficulty_actfl', 'id'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Multiple Choice', value: 'multiple_choice' },
        { label: 'Fill in the Blank', value: 'fill_blank' },
        { label: 'Matching', value: 'matching' },
        { label: 'Listening Comprehension', value: 'listening_comprehension' },
        { label: 'Reading Comprehension', value: 'reading_comprehension' },
        { label: 'Speaking', value: 'speaking' },
      ],
    },
    {
      name: 'difficulty_cefr',
      type: 'select',
      options: [
        { label: 'A1', value: 'A1' },
        { label: 'A2', value: 'A2' },
        { label: 'B1', value: 'B1' },
        { label: 'B2', value: 'B2' },
        { label: 'C1', value: 'C1' },
        { label: 'C2', value: 'C2' },
      ],
      admin: {
        description: 'Common European Framework of Reference for Languages',
      },
    },
    {
      name: 'difficulty_actfl',
      type: 'select',
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
        description: 'American Council on the Teaching of Foreign Languages',
      },
    },
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'text',
        },
      ],
    },
    {
      name: 'stem',
      type: 'richText',
      required: true,
    },
    {
      name: 'media',
      type: 'relationship',
      relationTo: 'media',
    },
    // Dynamic fields based on Question Type
    {
      name: 'options',
      type: 'array',
      label: 'Answer Options',
      admin: {
        condition: (_, siblingData) => ['multiple_choice', 'listening_comprehension', 'reading_comprehension'].includes(siblingData.type),
        description: 'Define the options for Multiple Choice questions.',
      },
      fields: [
        {
          name: 'text',
          type: 'text',
          required: true,
        },
        {
          name: 'isCorrect',
          type: 'checkbox',
          label: 'Is Correct Answer?',
          defaultValue: false,
        },
      ],
    },
    {
      name: 'matchingPairs',
      type: 'array',
      label: 'Matching Pairs',
      admin: {
        condition: (_, siblingData) => siblingData.type === 'matching',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'leftType',
              type: 'select',
              defaultValue: 'text',
              options: [
                { label: 'Text', value: 'text' },
                { label: 'Image', value: 'image' },
              ],
              admin: { width: '20%' },
            },
            {
              name: 'leftText',
              type: 'text',
              label: 'Left Text',
              admin: {
                condition: (_, siblingData) => siblingData.leftType === 'text',
                width: '30%',
              },
            },
            {
              name: 'leftImage',
              type: 'relationship',
              relationTo: 'media',
              label: 'Left Image',
              admin: {
                condition: (_, siblingData) => siblingData.leftType === 'image',
                width: '30%',
              },
            },
            {
              name: 'rightType',
              type: 'select',
              defaultValue: 'text',
              options: [
                { label: 'Text', value: 'text' },
                { label: 'Image', value: 'image' },
              ],
              admin: { width: '20%' },
            },
            {
              name: 'rightText',
              type: 'text',
              label: 'Right Text',
              admin: {
                condition: (_, siblingData) => siblingData.rightType === 'text',
                width: '30%',
              },
            },
            {
              name: 'rightImage',
              type: 'relationship',
              relationTo: 'media',
              label: 'Right Image',
              admin: {
                condition: (_, siblingData) => siblingData.rightType === 'image',
                width: '30%',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'blanks',
      type: 'array',
      label: 'Correct Answers for Blanks',
      admin: {
        condition: (_, siblingData) => siblingData.type === 'fill_blank',
        description: 'Define the correct answer(s) for each blank in the order they appear in the stem.',
      },
      fields: [
        {
          name: 'acceptedAnswers',
          type: 'text',
          required: true,
          admin: {
            description: 'Separate multiple acceptable answers with a pipe character (|). E.g. "color|colour"',
          },
        },
      ],
    },
    {
      name: 'speakingReference',
      type: 'textarea',
      label: 'Reference Text',
      admin: {
        condition: (_, siblingData) => siblingData.type === 'speaking',
        description: 'The text the user is expected to speak. If empty, the Stem will be used.',
      },
    },
  ],
}
