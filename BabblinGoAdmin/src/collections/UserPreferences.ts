import type { CollectionConfig, PayloadRequest } from 'payload';

const UserPreferences: CollectionConfig = {
  slug: 'user-preferences',
  admin: {
    group: 'User Management',
    useAsTitle: 'id',
    defaultColumns: ['user', 'updatedAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      // Managers can read all
      if (user.collection === 'users' && user.role === 'manager') return true;
      // Users can only read their own
      return {
        user: {
          equals: user.id,
        },
      };
    },
    create: ({ req: { user } }) => !!user, // Authenticated users can create
    update: ({ req: { user } }) => {
      if (!user) return false;
      if (user.collection === 'users' && user.role === 'manager') return true;
      return {
        user: {
          equals: user.id,
        },
      };
    },
    delete: ({ req: { user } }) => {
      if (!user) return false;
      return user.collection === 'users' && user.role === 'manager';
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true, // Should be set on creation and not changed
      },
      hooks: {
        beforeValidate: [
          ({ req, value, operation }) => {
            if (operation === 'create' && req.user) {
              return req.user.id;
            }
            return value;
          },
        ],
      },
    },
    {
      name: 'global',
      type: 'group',
      fields: [
        {
          name: 'playbackSpeed',
          type: 'number',
          defaultValue: 1.0,
          min: 0.25,
          max: 3.0,
        },
        {
          name: 'sessionDuration',
          type: 'number',
          defaultValue: 900, // 15 minutes in seconds
          min: 60,
        },
      ],
    },
    {
      name: 'courseOverrides',
      type: 'array',
      fields: [
        {
          name: 'course',
          type: 'relationship',
          relationTo: 'courses',
          required: true,
        },
        {
          name: 'trackingEnabled',
          type: 'checkbox',
          required: true,
        },
      ],
    },
  ],
};

export default UserPreferences;
