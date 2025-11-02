import type { CollectionConfig, PayloadRequest } from 'payload';

const Courses: CollectionConfig = {
  slug: 'courses',
  admin: {
    group: 'Course Management',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'order'],
  },
  access: {
    read: () => true,
    create: ({ req }: { req: PayloadRequest }) => !!req.user,
    update: ({ req }: { req: PayloadRequest }) => !!req.user,
    delete: ({ req }: { req: PayloadRequest }) => !!req.user,
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
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
      name: 'coverImage',
      type: 'relationship',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'order',
      type: 'number',
      required: false,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      defaultValue: 'draft',
      required: true,
      index: true,
    },
    {
      name: 'levels',
      type: 'array',
      required: false,
      fields: [
        {
          name: 'key',
          type: 'text',
          required: true,
        },
        {
          name: 'label',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'order',
          type: 'number',
          required: false,
        },
      ],
    },
  ],
};

export default Courses;
