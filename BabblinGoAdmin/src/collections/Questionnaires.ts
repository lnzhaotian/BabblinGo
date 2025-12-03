import type { CollectionConfig } from 'payload';

export const Questionnaires: CollectionConfig = {
  slug: 'questionnaires',
  admin: {
    useAsTitle: 'title',
    group: 'Testing',
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
      name: 'questions',
      type: 'array',
      fields: [
        {
          name: 'prompt',
          type: 'text',
          required: true,
        },
        {
          name: 'type',
          type: 'select',
          options: [
            { label: 'Text Input', value: 'text' },
            { label: 'Single Choice', value: 'choice' },
            { label: 'Multiple Choice', value: 'multiple_choice' },
            { label: 'Scale (1-5)', value: 'scale' },
          ],
          defaultValue: 'choice',
          required: true,
        },
        {
          name: 'options',
          type: 'array',
          admin: {
            condition: (_, siblingData) => ['choice', 'multiple_choice'].includes(siblingData.type),
          },
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
            },
            {
              name: 'value',
              type: 'text',
              required: true,
            },
          ],
        },
      ],
    },
  ],
};
