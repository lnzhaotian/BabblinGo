import type { CollectionConfig, CollectionSlug } from 'payload'

export const TestSessions: CollectionConfig = {
  slug: 'test-sessions',
  admin: {
    group: 'Assessment',
    useAsTitle: 'id',
    defaultColumns: ['user', 'blueprint', 'status', 'startTime'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (user && (user.role === 'manager' || user.role === 'editor')) {
        return true
      }
      if (user?.collection === 'users') {
        return {
          user: {
            equals: user.id,
          },
        }
      }
      return false // Default to private
    },
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user, // Ideally restricted to system or specific endpoints
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'blueprint',
      type: 'relationship',
      relationTo: 'test-blueprints' as unknown as CollectionSlug,
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'started',
      options: [
        { label: 'Started', value: 'started' },
        { label: 'Completed', value: 'completed' },
        { label: 'Abandoned', value: 'abandoned' },
      ],
    },
    {
      name: 'startTime',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
    },
    {
      name: 'endTime',
      type: 'date',
    },
    {
      name: 'currentEstimate',
      type: 'json',
      admin: {
        description: 'Current estimated skill level or internal state of the adaptive engine',
      },
    },
    {
      name: 'generatedQuestions',
      type: 'relationship',
      relationTo: 'question-bank' as unknown as CollectionSlug,
      hasMany: true,
      admin: {
        description: 'The list of questions generated for this session (for randomized/adaptive strategies)',
        readOnly: true,
      },
    },
    {
      name: 'questionnaireAnswers',
      type: 'array',
      fields: [
        {
          name: 'questionnaire',
          type: 'relationship',
          relationTo: 'questionnaires' as unknown as CollectionSlug,
          required: true,
        },
        {
          name: 'answers',
          type: 'json', // Store as { [questionIndex]: answerValue }
          required: true,
        },
      ],
    },
    {
      name: 'history',
      type: 'array',
      fields: [
        {
          name: 'question',
          type: 'relationship',
          relationTo: 'question-bank' as unknown as CollectionSlug,
          required: true,
        },
        {
          name: 'tags',
          type: 'json',
          admin: {
            readOnly: true,
            description: 'Tags associated with the question at the time of answering',
          },
        },
        {
          name: 'userAnswer',
          type: 'json',
          required: true,
          admin: {
            description: 'Raw answer data',
          },
        },
        {
          name: 'readableAnswer',
          type: 'textarea',
          admin: {
            readOnly: true,
            description: 'Human-readable answer',
          },
        },
        {
          name: 'isCorrect',
          type: 'checkbox',
          required: true,
        },
        {
          name: 'timeTaken',
          type: 'number',
          admin: {
            description: 'Time taken in seconds',
          },
        },
        {
          name: 'awardedScore',
          type: 'number',
        },
        {
          name: 'timestamp',
          type: 'date',
          defaultValue: () => new Date().toISOString(),
        },
      ],
    },
    {
      name: 'finalResult',
      type: 'json',
      admin: {
        description: 'Computed score, CEFR/ACTFL level, and feedback',
      },
    },
  ],
}
