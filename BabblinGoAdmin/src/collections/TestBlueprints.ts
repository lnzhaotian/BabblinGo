import type { CollectionConfig } from 'payload'

export const TestBlueprints: CollectionConfig = {
  slug: 'test-blueprints',
  admin: {
    group: 'Assessment',
    useAsTitle: 'title',
    defaultColumns: ['title', 'strategy'],
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
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'strategy',
      type: 'select',
      required: true,
      options: [
        { label: 'Linear (Fixed)', value: 'linear' },
        { label: 'Randomized Pool', value: 'randomized_pool' },
        { label: 'Adaptive (Rule Based)', value: 'adaptive_rule_based' },
      ],
    },
    {
      name: 'preTestQuestionnaire',
      type: 'relationship',
      relationTo: 'questionnaires',
      label: 'Pre-Test Questionnaire',
    },
    {
      name: 'postTestQuestionnaire',
      type: 'relationship',
      relationTo: 'questionnaires',
      label: 'Post-Test Questionnaire',
    },
    // Linear Strategy Config
    {
      name: 'linearQuestions',
      type: 'relationship',
      relationTo: 'question-bank',
      hasMany: true,
      label: 'Questions (Ordered)',
      admin: {
        condition: (_, { strategy }) => strategy === 'linear',
      },
    },
    // Randomized Pool Strategy Config
    {
      name: 'poolConfig',
      type: 'group',
      label: 'Pool Configuration',
      admin: {
        condition: (_, { strategy }) => strategy === 'randomized_pool',
      },
      fields: [
        {
          name: 'poolSize',
          type: 'number',
          required: true,
          defaultValue: 10,
        },
        {
          name: 'tags',
          type: 'text', // Could be a relationship to a Tags collection if it existed
          hasMany: true,
          label: 'Filter by Tags',
        },
        {
          name: 'difficultyRange',
          type: 'group',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'min', type: 'number', min: 1, max: 10, defaultValue: 1 },
                { name: 'max', type: 'number', min: 1, max: 10, defaultValue: 10 },
              ],
            },
          ],
        },
      ],
    },
    // Adaptive Strategy Config
    {
      name: 'adaptiveConfig',
      type: 'group',
      label: 'Adaptive Configuration',
      admin: {
        condition: (_, { strategy }) => strategy === 'adaptive_rule_based',
      },
      fields: [
        {
          name: 'difficultyStandard',
          type: 'select',
          required: true,
          defaultValue: 'cefr',
          options: [
            { label: 'CEFR (A1-C2)', value: 'cefr' },
            { label: 'ACTFL (Novice-Distinguished)', value: 'actfl' },
          ],
        },
        {
          name: 'initialDifficulty',
          type: 'number',
          required: true,
          defaultValue: 3,
          admin: {
            description: '1-6 for CEFR, 1-11 for ACTFL',
          },
        },
        {
          name: 'minQuestions',
          type: 'number',
          required: true,
          defaultValue: 10,
        },
        {
          name: 'maxQuestions',
          type: 'number',
          required: true,
          defaultValue: 20,
        },
      ],
    },
  ],
}
