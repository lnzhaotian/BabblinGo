import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    group: 'System',
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    // Email added by default
    {
      name: 'displayName',
      type: 'text',
      required: true,
      label: 'Display Name',
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      label: 'Avatar',
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Bio',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      options: [
        { label: 'User', value: 'user' },
        { label: 'Editor', value: 'editor' },
        { label: 'Manager', value: 'manager' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    // Add more fields as needed
  ],
  access: {
    admin: ({ req: { user } }) => {
      // Only allow editors and managers to access the admin UI
      return !!user && user.role && (user.role === 'editor' || user.role === 'manager');
    },
    read: ({ req: { user }, id }) => {
      // Allow users to read themselves, editors/managers can read all
      if (!user) return false;
      if (user.role === 'editor' || user.role === 'manager') return true;
      return user.id === id;
    },
    update: ({ req: { user }, id }) => {
      // Allow users to update themselves, managers can update any, editors only themselves
      if (!user || !user.role) return false;
      if (user.role === 'manager') return true;
      return user.id === id;
    },
    delete: ({ req: { user }, id }) => {
      if (!user || !user.role) return false;
      if (user.role === 'manager') return true;
      return user.id === id;
    },
    create: ({ req: { user } }) => {
      return !!user && user.role === 'manager';
    },
  },
}
