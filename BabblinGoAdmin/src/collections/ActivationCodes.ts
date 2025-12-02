import { CollectionConfig } from 'payload'

const ActivationCodes: CollectionConfig = {
  slug: 'activation-codes',
  admin: {
    useAsTitle: 'code',
    group: 'System',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.collection === 'users' && user?.role === 'manager') {
        return true
      }
      return false
    },
    create: ({ req: { user } }) => {
      if (user?.collection === 'users' && user?.role === 'manager') {
        return true
      }
      return false
    },
    update: ({ req: { user } }) => {
      if (user?.collection === 'users' && user?.role === 'manager') {
        return true
      }
      return false
    },
    delete: ({ req: { user } }) => {
      if (user?.collection === 'users' && user?.role === 'manager') {
        return true
      }
      return false
    },
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'tokens',
      type: 'number',
      required: true,
      min: 1,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Used', value: 'used' },
        { label: 'Expired', value: 'expired' },
      ],
      defaultValue: 'active',
      required: true,
    },
    {
      name: 'usedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'usedAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'batch',
      type: 'relationship',
      relationTo: 'activation-batches',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
}

export default ActivationCodes
