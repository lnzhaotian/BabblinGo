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
      name: 'avatarIcon',
      type: 'text',
      label: 'Avatar Icon',
      admin: {
        description: 'Material Icon name for avatar (e.g., person, face, school). Used when no avatar image is uploaded.',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Bio',
       maxLength: 500,
       admin: {
         description: 'A short biography (max 500 characters)',
       },
     },
     {
       name: 'location',
       type: 'text',
       label: 'Location',
       admin: {
         description: 'City, country, or region',
       },
     },
     {
       name: 'website',
       type: 'text',
       label: 'Website',
       admin: {
         description: 'Personal website or social media profile URL',
       },
     },
     {
       name: 'dateOfBirth',
       type: 'date',
       label: 'Date of Birth',
       admin: {
         description: 'Used for age-appropriate content and analytics',
       },
     },
     {
       name: 'nativeLanguage',
       type: 'text',
       label: 'Native Language',
       admin: {
         description: 'User\'s native language',
       },
     },
     {
       name: 'learningLanguages',
       type: 'array',
       label: 'Learning Languages',
       fields: [
         {
           name: 'language',
           type: 'text',
           required: true,
         },
         {
           name: 'level',
           type: 'select',
           options: [
             { label: 'Beginner', value: 'beginner' },
             { label: 'Elementary', value: 'elementary' },
             { label: 'Intermediate', value: 'intermediate' },
             { label: 'Advanced', value: 'advanced' },
             { label: 'Native', value: 'native' },
           ],
         },
       ],
       admin: {
         description: 'Languages the user is currently learning',
       },
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
    {
      name: 'tokenBalance',
      type: 'number',
      defaultValue: 1000, // Give some initial tokens
      admin: {
        position: 'sidebar',
        description: 'Current token balance for AI usage',
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
    // Allow public self-registration via POST /api/users
    // Password hashing and auth handling are managed by Payload when auth: true
    create: () => true,
  },
}
