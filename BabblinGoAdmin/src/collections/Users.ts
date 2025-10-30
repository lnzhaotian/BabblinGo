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
    read: ({ req: { user } }) => {
      // Editors and managers can read all users
      return !!user && (user.role === 'editor' || user.role === 'manager');
    },
    update: ({ req: { user }, id }) => {
      // Managers can update any user; editors can only update themselves
      if (!user || !user.role) return false;
      if (user.role === 'manager') return true;
      if (user.role === 'editor') return user.id === id;
      return false;
    },
    delete: ({ req: { user }, id }) => {
      // Managers can delete any user; editors can only delete themselves
      if (!user || !user.role) return false;
      if (user.role === 'manager') return true;
      if (user.role === 'editor') return user.id === id;
      return false;
    },
    create: ({ req: { user } }) => {
      // Only managers can create users
      return !!user && user.role === 'manager';
    },
  },
}
